import minimist from "minimist";
import axios from "axios";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  withPaymentInterceptor,
  decodeXPaymentResponse,
  createSigner,
} from "x402-axios";
import { readFileSync } from "fs";
import { resolve } from "path";

const privateKey = process.env.EVM_PRIVATE_KEY as Hex;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "https://api.snack.money";

/**
 * Parse amount from various formats:
 * - "50¢" -> 0.50
 * - "$0.5" or "$0.50" -> 0.50
 * - "0.5" -> 0.50
 */
function parseAmount(amountStr: string | number): number {
  if (typeof amountStr === 'number') {
    return amountStr;
  }

  const trimmed = amountStr.trim();

  // Handle cents notation (50¢)
  if (trimmed.endsWith('¢')) {
    const cents = parseFloat(trimmed.slice(0, -1));
    if (isNaN(cents)) {
      throw new Error(`Invalid cents amount: ${amountStr}`);
    }
    return cents / 100;
  }

  // Handle dollar notation ($0.5 or $0.50)
  if (trimmed.startsWith('$')) {
    const dollars = parseFloat(trimmed.slice(1));
    if (isNaN(dollars)) {
      throw new Error(`Invalid dollar amount: ${amountStr}`);
    }
    return dollars;
  }

  // Handle plain decimal (0.5)
  const amount = parseFloat(trimmed);
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }
  return amount;
}

/**
 * Validate X/Twitter username
 * Rules: 1-15 characters, alphanumeric and underscores only
 */
function validateXUsername(username: string): void {
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
    throw new Error(`Invalid X/Twitter username: ${username}. Must be 1-15 alphanumeric characters or underscores.`);
  }
}

/**
 * Validate Farcaster username
 * Rules: 1-16 characters, alphanumeric, hyphens, and underscores, must start with alphanumeric
 */
function validateFarcasterUsername(username: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,15}$/.test(username)) {
    throw new Error(`Invalid Farcaster username: ${username}. Must be 1-16 characters, start with alphanumeric, contain only letters, numbers, hyphens, and underscores.`);
  }
}

/**
 * Validate GitHub username
 * Rules: 1-39 characters, alphanumeric and hyphens, cannot start/end with hyphen, no consecutive hyphens
 */
function validateGitHubUsername(username: string): void {
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username) || /--/.test(username)) {
    throw new Error(`Invalid GitHub username: ${username}. Must be 1-39 alphanumeric characters or hyphens, cannot start/end with hyphen or have consecutive hyphens.`);
  }
}

/**
 * Validate email address
 */
function validateEmail(email: string): void {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email address: ${email}`);
  }
}

/**
 * Validate web domain
 * Rules: Valid domain name format
 */
function validateWebDomain(domain: string): void {
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new Error(`Invalid web domain: ${domain}. Must be a valid domain name (e.g., snack.money)`);
  }
}

/**
 * Validate receiver based on platform
 */
function validateReceiver(platform: string, receiver: string): void {
  switch (platform) {
    case 'x':
      validateXUsername(receiver);
      break;
    case 'farcaster':
      validateFarcasterUsername(receiver);
      break;
    case 'github':
      validateGitHubUsername(receiver);
      break;
    case 'email':
      validateEmail(receiver);
      break;
    case 'web':
      validateWebDomain(receiver);
      break;
  }
}

/**
 * Normalize platform name with domain extensions:
 * - "x.com", "twitter.com", "twitter", "x" -> "x"
 * - "farcaster.xyz", "farcaster" -> "farcaster"
 * - "github.com", "github" -> "github"
 */
function normalizePlatform(platform: string): string {
  const lower = platform.toLowerCase();

  const platformMap: Record<string, string> = {
    'x': 'x',
    'x.com': 'x',
    'twitter': 'x',
    'twitter.com': 'x',
    'farcaster': 'farcaster',
    'farcaster.xyz': 'farcaster',
    'github': 'github',
    'github.com': 'github',
    'email': 'email',
    'web': 'web',
  };

  const normalized = platformMap[lower];
  if (!normalized) {
    throw new Error(`Unknown platform: ${platform}. Supported: x, twitter, farcaster, github, email, web (with optional domain extensions)`);
  }

  return normalized;
}

/**
 * Parse comma-separated receivers format:
 * "x/user1:1¢,user2:$0.5,user3:75¢"
 */
function parseCommaSeparated(input: string): { platform: string; payments: Array<{receiver: string, amount: number}> } {
  // Split by first slash to get platform and receivers
  const firstSlash = input.indexOf('/');
  if (firstSlash === -1) {
    throw new Error(`Invalid format: ${input}. Expected: platform/receiver1:amount1,receiver2:amount2`);
  }

  const platformStr = input.substring(0, firstSlash);
  const receiversStr = input.substring(firstSlash + 1);

  const platform = normalizePlatform(platformStr);

  // Split by comma to get individual receiver:amount pairs
  const pairs = receiversStr.split(',');
  const payments: Array<{receiver: string, amount: number}> = [];

  for (const pair of pairs) {
    const colonIndex = pair.lastIndexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Missing amount for ${pair}. Format: receiver:amount`);
    }

    const receiver = pair.substring(0, colonIndex);
    const amountStr = pair.substring(colonIndex + 1);

    // Validate receiver for this platform
    validateReceiver(platform, receiver);

    payments.push({
      receiver,
      amount: parseAmount(amountStr),
    });
  }

  return { platform, payments };
}

/**
 * Load JSON from file path
 */
async function loadFromFile(filePath: string): Promise<any> {
  try {
    // Remove file: prefix if present
    const cleanPath = filePath.startsWith('file:') ? filePath.substring(5) : filePath;
    const absolutePath = resolve(cleanPath);
    const content = readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Load JSON from HTTP/HTTPS URL
 */
async function loadFromURL(url: string): Promise<any> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

/**
 * Parse JSON format payments
 */
function parseJSONPayments(data: any): { platform: string; payments: Array<{receiver: string, amount: number}> } {
  if (!data.platform) {
    throw new Error('JSON must contain "platform" field');
  }
  if (!Array.isArray(data.payments)) {
    throw new Error('JSON must contain "payments" array');
  }

  const platform = normalizePlatform(data.platform);
  const payments: Array<{receiver: string, amount: number}> = [];

  for (const payment of data.payments) {
    if (!payment.receiver) {
      throw new Error('Each payment must have "receiver" field');
    }
    if (payment.amount === undefined) {
      throw new Error('Each payment must have "amount" field');
    }

    // Validate receiver for this platform
    validateReceiver(platform, payment.receiver);

    payments.push({
      receiver: payment.receiver,
      amount: parseAmount(payment.amount),
    });
  }

  return { platform, payments };
}

const args = minimist(process.argv.slice(2));

let receiverIdentity: string;
let receivers: Array<{receiver: string, amount: number}>;
let useSolana: boolean;

if (args._.length === 0) {
  console.error("Usage: snackmoney batch-pay <input> [--network <base|solana>]");
  console.error("\nInput formats:");
  console.error("  1. Comma-separated: x/user1:1¢,user2:$0.5");
  console.error("  2. JSON string: '{\"platform\":\"x\",\"payments\":[{\"receiver\":\"user\",\"amount\":\"1¢\"}]}'");
  console.error("  3. File path: ./payments.json or file:./payments.json");
  console.error("  4. HTTP URL: https://example.com/payments.json");
  console.error("\nExamples:");
  console.error("  snackmoney batch-pay x/user1:1¢,user2:$0.5");
  console.error("  snackmoney batch-pay x.com/user1:1¢,user2:$0.5");
  console.error("  snackmoney batch-pay twitter.com/user1:1¢,user2:$0.5");
  console.error("  snackmoney batch-pay farcaster.xyz/toly:50¢,mesut:25¢");
  console.error("  snackmoney batch-pay ./payments.json");
  console.error("  snackmoney batch-pay https://example.com/payments.json");
  process.exit(1);
}

async function parseInput(): Promise<void> {
  try {
    const input = args._[0];

    let platform: string;
    let payments: Array<{receiver: string, amount: number}>;

    // Check input type
    if (input.startsWith('http://') || input.startsWith('https://')) {
      // HTTP/HTTPS URL
      const data = await loadFromURL(input);
      const parsed = parseJSONPayments(data);
      platform = parsed.platform;
      payments = parsed.payments;
    } else if (input.startsWith('file:') || input.endsWith('.json')) {
      // File path
      const data = await loadFromFile(input);
      const parsed = parseJSONPayments(data);
      platform = parsed.platform;
      payments = parsed.payments;
    } else if (input.startsWith('{')) {
      // JSON string
      const data = JSON.parse(input);
      const parsed = parseJSONPayments(data);
      platform = parsed.platform;
      payments = parsed.payments;
    } else {
      // Comma-separated format
      const parsed = parseCommaSeparated(input);
      platform = parsed.platform;
      payments = parsed.payments;
    }

    receiverIdentity = platform;
    receivers = payments;
  } catch (error: any) {
    console.error(`❌ ${error.message}`);
    console.error("\nUsage: snackmoney batch-pay <input> [--network <base|solana>]");
    console.error("\nInput formats:");
    console.error("  1. Comma-separated: x/user1:1¢,user2:$0.5");
    console.error("  2. JSON string: '{\"platform\":\"x\",\"payments\":[{\"receiver\":\"user\",\"amount\":\"1¢\"}]}'");
    console.error("  3. File path: ./payments.json or file:./payments.json");
    console.error("  4. HTTP URL: https://example.com/payments.json");
    process.exit(1);
  }
}

// Initialization function
async function init(): Promise<void> {
  // Parse input (async)
  await parseInput();

  // Input validations
  const allowedIdentities = ["x", "farcaster", "web", "email", "github"];
  if (!allowedIdentities.includes(receiverIdentity)) {
    console.error(`❌ Platform must be one of: ${allowedIdentities.join(", ")}`);
    console.error(`   Got: ${receiverIdentity}`);
    console.error(`   Tip: Use 'twitter' or 'x' for X/Twitter payments`);
    process.exit(1);
  }

  // Validate network parameter if provided
  const allowedNetworks = ["base", "solana"];

  // Check which private keys are available
  const hasEvmKey = !!privateKey;
  const hasSvmKey = !!svmPrivateKey;

  // Determine network based on provided arg or auto-detect
  if (args.network) {
    // Network explicitly specified
    if (!allowedNetworks.includes(args.network.toLowerCase())) {
      console.error(`network must be either ${allowedNetworks.map(n => `'${n}'`).join(" or ")}`);
      process.exit(1);
    }

    useSolana = args.network.toLowerCase() === "solana";

    // Validate the required key is available for the specified network
    if (useSolana && !hasSvmKey) {
      console.error("❌ Missing SVM_PRIVATE_KEY environment variable (needed for --network solana)");
      process.exit(1);
    }
    if (!useSolana && !hasEvmKey) {
      console.error("❌ Missing EVM_PRIVATE_KEY environment variable (needed for --network base)");
      process.exit(1);
    }
  } else {
    // No network specified, auto-detect from available keys
    if (hasEvmKey && hasSvmKey) {
      console.error("❌ Both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY environment variables are set");
      console.error("   Please specify which network to use with --network <base|solana>");
      process.exit(1);
    } else if (hasSvmKey) {
      useSolana = true;
      console.log("ℹ️  Auto-detected network: Solana (based on SVM_PRIVATE_KEY)");
    } else if (hasEvmKey) {
      useSolana = false;
      console.log("ℹ️  Auto-detected network: Base (based on EVM_PRIVATE_KEY)");
    } else {
      console.error("❌ No private keys found in environment variables");
      console.error("   Set either EVM_PRIVATE_KEY (for Base) or SVM_PRIVATE_KEY (for Solana)");
      process.exit(1);
    }
  }
}

/**
 * Batch payment example supporting both Ethereum and Solana signers
 */
async function main(): Promise<void> {
  let api;
  let network;

  if (useSolana) {
    console.log("\n🔧 Creating Solana signer...");
    
    // Use mainnet for production, devnet for local development
    network = baseURL?.includes('localhost') || baseURL?.includes('127.0.0.1')
      ? "solana-devnet"
      : "solana";

    const signer = await createSigner(network, svmPrivateKey);
    console.log("✅ Solana signer created");
    
    api = withPaymentInterceptor(
      axios.create({ baseURL }),
      signer,
    );
  } else {
    console.log("\n🔧 Creating Base signer...");
    network = "base";
    
    const account = privateKeyToAccount(privateKey);
    console.log("✅ Base signer created");
    
    api = withPaymentInterceptor(
      axios.create({ baseURL }),
      account as never,
    );
  }

  console.log(`\n💸 Sending batch payment to ${receivers.length} recipients on ${receiverIdentity}...`);
  console.log(`   Using endpoint: ${baseURL}/payments/${receiverIdentity}/batch-pay`);
  console.log(`   Network: ${useSolana ? (network === 'solana' ? 'Solana Mainnet' : 'Solana Devnet') : 'Base'}\n`);

  try {
    const response = await api.post(`/payments/${receiverIdentity}/batch-pay`, { 
      currency: "USDC",
      type: "social-network",
      sender_username: "snackmoney-agent-x402",
      receivers,
    });

    console.log(`✅ ${response.data?.msg || 'Batch payment sent'} | 👥 ${receivers.length} recipients`);
    if (response.data?.txn_id || response.data?.data?.txn_id) {
      const txnId = response.data?.txn_id || response.data?.data?.txn_id;
      console.log(`🔗 TXN: ${txnId}`);
    }

    // Check for individual receipts per receiver
    if (response.data?.data && Array.isArray(response.data.data)) {
      console.log(`\n📄 Individual Receipts:`);
      response.data.data.forEach((receiptData: any, index: number) => {
        const username = receiptData.username || receiptData.receiver || receivers[index].receiver;
        const receipt = receiptData.receipt;
        const status = receiptData.status ? ` (${receiptData.status})` : '';
        console.log(`   ${index + 1}. ${username}: ${receipt}${status}`);
      });
    } else if (response.data?.receipts && Array.isArray(response.data.receipts)) {
      console.log(`\n📄 Individual Receipts:`);
      response.data.receipts.forEach((receiptData: any, index: number) => {
        console.log(`   ${index + 1}. ${receiptData.receiver || receivers[index].receiver}: ${receiptData.receipt || receiptData}`);
      });
    } else if (response.data?.receipt || response.data?.data?.receipt) {
      // Fallback to single receipt if no individual receipts
      const receipt = response.data?.receipt || response.data?.data?.receipt;
      console.log(`📄 Receipt: ${receipt}`);
    }

    // Decode payment response to see transaction details
    const paymentResponseHeader = response.headers["x-payment-response"];
    if (paymentResponseHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
      console.log("\n💳 Payment details:");
      console.log("   Network:", paymentResponse.network);
      console.log("   Transaction hash:", paymentResponse.transaction);
      
      if (useSolana) {
        console.log("\n🔗 View on Solscan:");
        const cluster = network === 'solana' ? '' : '?cluster=devnet';
        console.log(`   https://solscan.io/tx/${paymentResponse.transaction}${cluster}`);
      } else {
        console.log("\n🔗 View on Etherscan:");
        console.log(`   https://etherscan.io/tx/${paymentResponse.transaction}`);
      }
    }
  } catch (error: any) {
    console.log(`❌ ${error.response?.data?.msg || 'Batch payment failed'}`);
    
    if (error.response) {
      console.error("   Status:", error.response.status);
      
      // Show payment options if 402
      if (error.response.status === 402 && error.response.data.accepts) {
        console.log("\n💡 Available payment options:");
        error.response.data.accepts.forEach((accept: any, i: number) => {
          console.log(`   ${i + 1}. ${accept.network} - Pay to: ${accept.payTo}`);
        });
      }
    } else {
      console.error("   Error:", error.message);
    }
    process.exit(1);
  }
}

// Execute
(async () => {
  await init();
  await main();
})();
