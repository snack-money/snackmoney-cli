import minimist from "minimist";
import axios from "axios";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  withPaymentInterceptor,
  decodeXPaymentResponse,
  createSigner,
} from "x402-axios";

const privateKey = process.env.EVM_PRIVATE_KEY as Hex;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "https://api.snack.money";

/**
 * Parse amount from various formats:
 * - "50¢" -> 0.50
 * - "$0.5" or "$0.50" -> 0.50
 * - "0.5" -> 0.50
 *
 * @param amountStr
 */
function parseAmount(amountStr: string): number {
  const trimmed = amountStr.trim();

  // Handle cents notation (50¢)
  if (trimmed.endsWith("¢")) {
    const cents = parseFloat(trimmed.slice(0, -1));
    if (isNaN(cents)) {
      throw new Error(`Invalid cents amount: ${amountStr}`);
    }
    return cents / 100;
  }

  // Handle dollar notation ($0.5 or $0.50)
  if (trimmed.startsWith("$")) {
    const dollarPart = trimmed.slice(1);

    // Check if it looks like a shell positional parameter ($1, $2, $10, etc.)
    if (/^\d+$/.test(dollarPart)) {
      const dollars = parseInt(dollarPart, 10);
      const cents = dollars * 100;
      throw new Error(
        `Dollar amounts like $${dollars} can be interpreted as shell variables. Please use ${cents}¢ instead (or quote as '\\$${dollars}').`,
      );
    }

    const dollars = parseFloat(dollarPart);
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
 *
 * @param username
 */
function validateXUsername(username: string): void {
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
    throw new Error(
      `Invalid X/Twitter username: ${username}. Must be 1-15 alphanumeric characters or underscores.`,
    );
  }
}

/**
 * Validate Farcaster username
 * Rules: 1-16 characters, alphanumeric, hyphens, and underscores, must start with alphanumeric
 *
 * @param username
 */
function validateFarcasterUsername(username: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,15}$/.test(username)) {
    throw new Error(
      `Invalid Farcaster username: ${username}. Must be 1-16 characters, start with alphanumeric, contain only letters, numbers, hyphens, and underscores.`,
    );
  }
}

/**
 * Validate GitHub username
 * Rules: 1-39 characters, alphanumeric and hyphens, cannot start/end with hyphen, no consecutive hyphens
 *
 * @param username
 */
function validateGitHubUsername(username: string): void {
  if (
    !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username) ||
    /--/.test(username)
  ) {
    throw new Error(
      `Invalid GitHub username: ${username}. Must be 1-39 alphanumeric characters or hyphens, cannot start/end with hyphen or have consecutive hyphens.`,
    );
  }
}

/**
 * Validate email address
 *
 * @param email
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
 *
 * @param domain
 */
function validateWebDomain(domain: string): void {
  const domainRegex =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new Error(
      `Invalid web domain: ${domain}. Must be a valid domain name (e.g., snack.money)`,
    );
  }
}

/**
 * Normalize platform name with domain extensions:
 * - "x.com", "twitter.com", "twitter", "x" -> "x"
 * - "farcaster.xyz", "farcaster" -> "farcaster"
 * - "github.com", "github" -> "github"
 *
 * @param platform
 */
function normalizePlatform(platform: string): string {
  const lower = platform.toLowerCase();

  // Map domain extensions and aliases to platform
  const platformMap: Record<string, string> = {
    x: "x",
    "x.com": "x",
    twitter: "x",
    "twitter.com": "x",
    farcaster: "farcaster",
    "farcaster.xyz": "farcaster",
    github: "github",
    "github.com": "github",
    email: "email",
    web: "web",
  };

  const normalized = platformMap[lower];
  if (!normalized) {
    throw new Error(
      `Unknown platform: ${platform}. Supported: x, twitter, farcaster, github, email, web (with optional domain extensions)`,
    );
  }

  return normalized;
}

/**
 * Parse URL-style payment target:
 * - "x/aeyakovenko" -> { identity: "x", receiver: "aeyakovenko" }
 * - "x.com/aeyakovenko" -> { identity: "x", receiver: "aeyakovenko" }
 * - "twitter.com/user" -> { identity: "x", receiver: "user" }
 * - "farcaster.xyz/toly" -> { identity: "farcaster", receiver: "toly" }
 * - "github.com/user" -> { identity: "github", receiver: "user" }
 * - "email/user@example.com" -> { identity: "email", receiver: "user@example.com" }
 * - "web/snack.money" -> { identity: "web", receiver: "snack.money" }
 *
 * @param target
 */
function parsePaymentTarget(target: string): {
  identity: string;
  receiver: string;
} {
  const parts = target.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid payment target format: ${target}. Expected format: platform/username`,
    );
  }

  let [platform, receiver] = parts;

  const identity = normalizePlatform(platform);

  // Validate receiver based on platform
  switch (identity) {
    case "x":
      validateXUsername(receiver);
      break;
    case "farcaster":
      validateFarcasterUsername(receiver);
      break;
    case "github":
      validateGitHubUsername(receiver);
      break;
    case "email":
      validateEmail(receiver);
      break;
    case "web":
      validateWebDomain(receiver);
      break;
  }

  return { identity, receiver };
}

const args = minimist(process.argv.slice(2));

let receiverIdentity: string;
let receiver: string;
let amount: number;

if (args._.length < 2) {
  console.error(
    "Usage: snackmoney send <platform/user> <amount> [--network <base|solana>]",
  );
  console.error("\nExamples:");
  console.error("  snackmoney send x/jessepollak 1¢");
  console.error("  snackmoney send twitter/0xmesuthere 50¢");
  console.error("  snackmoney send farcaster/toly 100¢");
  console.error("  snackmoney send github/0xsnackbaker 200¢");
  console.error("  snackmoney send web/snack.money 0.01");
  console.error("  snackmoney send email/mesut@snack.money 0.25");
  console.error(
    "\nAmount formats: 100¢ (cents - recommended), 0.5 (decimal), or '$0.5' (dollars - must be quoted)",
  );
  console.error(
    "\nNote: For whole dollar amounts, use cents (e.g., 100¢ instead of $1) to avoid shell variable conflicts.",
  );
  console.error(
    "      If --network is not specified, it will be auto-detected based on available private keys.",
  );
  console.error(
    "      If both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY are set, you must specify --network.",
  );
  process.exit(1);
}

try {
  const target = parsePaymentTarget(args._[0]);
  receiverIdentity = target.identity;
  receiver = target.receiver;
  amount = parseAmount(args._[1]);
} catch (error: any) {
  console.error(`❌ ${error.message}`);
  console.error(
    "\nUsage: snackmoney send <platform/user> <amount> [--network <base|solana>]",
  );
  console.error("\nExamples:");
  console.error("  snackmoney send x/jessepollak 1¢");
  console.error("  snackmoney send twitter/0xmesuthere 50¢");
  console.error("  snackmoney send farcaster/toly 100¢");
  console.error("  snackmoney send github/0xsnackbaker 200¢");
  console.error("  snackmoney send web/snack.money 0.01");
  console.error("  snackmoney send email/mesut@snack.money 0.25");
  console.error(
    "\nAmount formats: 100¢ (cents - recommended), 0.5 (decimal), or '$0.5' (dollars - must be quoted)",
  );
  console.error(
    "\nNote: For whole dollar amounts, use cents (e.g., 100¢ instead of $1) to avoid shell variable conflicts.",
  );
  console.error(
    "      If --network is not specified, it will be auto-detected based on available private keys.",
  );
  console.error(
    "      If both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY are set, you must specify --network.",
  );
  process.exit(1);
}

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
let useSolana: boolean;

if (args.network) {
  // Network explicitly specified
  if (!allowedNetworks.includes(args.network.toLowerCase())) {
    console.error(
      `network must be either ${allowedNetworks.map((n) => `'${n}'`).join(" or ")}`,
    );
    process.exit(1);
  }

  useSolana = args.network.toLowerCase() === "solana";

  // Validate the required key is available for the specified network
  if (useSolana && !hasSvmKey) {
    console.error(
      "❌ Missing SVM_PRIVATE_KEY environment variable (needed for --network solana)",
    );
    process.exit(1);
  }
  if (!useSolana && !hasEvmKey) {
    console.error(
      "❌ Missing EVM_PRIVATE_KEY environment variable (needed for --network base)",
    );
    process.exit(1);
  }
} else {
  // No network specified, auto-detect from available keys
  if (hasEvmKey && hasSvmKey) {
    console.error(
      "❌ Both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY environment variables are set",
    );
    console.error(
      "   Please specify which network to use with --network <base|solana>",
    );
    process.exit(1);
  } else if (hasSvmKey) {
    useSolana = true;
    console.log("ℹ️  Auto-detected network: Solana (based on SVM_PRIVATE_KEY)");
  } else if (hasEvmKey) {
    useSolana = false;
    console.log("ℹ️  Auto-detected network: Base (based on EVM_PRIVATE_KEY)");
  } else {
    console.error("❌ No private keys found in environment variables");
    console.error(
      "   Set either EVM_PRIVATE_KEY (for Base) or SVM_PRIVATE_KEY (for Solana)",
    );
    process.exit(1);
  }
}

/**
 * Payment example supporting both Ethereum and Solana signers
 *
 * This will:
 * 1. Make a request to the API without payment (get 402 response)
 * 2. Create either an Ethereum or Solana signer based on --solana flag
 * 3. Pay with USDC to the commission wallet
 * 4. Complete the payment and get the response
 */
async function main(): Promise<void> {
  let api;
  let network;

  if (useSolana) {
    console.log("\n🔧 Creating Solana signer...");

    // Use mainnet for production, devnet for local development
    network =
      baseURL?.includes("localhost") || baseURL?.includes("127.0.0.1")
        ? "solana-devnet"
        : "solana";

    const signer = await createSigner(network, svmPrivateKey);
    console.log("✅ Solana signer created");

    api = withPaymentInterceptor(axios.create({ baseURL }), signer);
  } else {
    console.log("\n🔧 Creating Base signer...");
    network = "base";

    const account = privateKeyToAccount(privateKey);
    console.log("✅ Base signer created");

    api = withPaymentInterceptor(axios.create({ baseURL }), account as never);
  }

  console.log(
    `\n💸 Sending payment to ${receiverIdentity}:${receiver} (${amount} USDC)...`,
  );
  console.log(`   Using endpoint: ${baseURL}/payments/${receiverIdentity}/pay`);
  console.log(
    `   Network: ${useSolana ? (network === "solana" ? "Solana Mainnet" : "Solana Devnet") : "Base"}\n`,
  );

  try {
    const response = await api.post(`/payments/${receiverIdentity}/pay`, {
      amount,
      currency: "USDC",
      receiver: receiver,
      description: `Payment via X402 (${useSolana ? "Solana" : "Ethereum"})`,
    });

    console.log(
      `✅ ${response.data?.msg || "Payment sent"} | 💰 ${amount} USDC → ${receiver}`,
    );

    // Show transaction ID
    if (response.data?.txn_id || response.data?.data?.txn_id) {
      const txnId = response.data?.txn_id || response.data?.data?.txn_id;
      console.log(`🔗 TXN: ${txnId}`);
    }

    // Show fee from payment response header (priority)
    const paymentResponseHeader = response.headers["x-payment-response"];
    if (paymentResponseHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
      console.log(`� Fee: Network fee paid on ${paymentResponse.network}`);
    }

    // Show Snack Money receipt URL (priority over blockchain explorers)
    if (response.data?.receipt || response.data?.data?.receipt) {
      const receipt = response.data?.receipt || response.data?.data?.receipt;
      console.log(`📄 Receipt: ${receipt}`);
    }
  } catch (error: any) {
    console.log(`❌ ${error.response?.data?.msg || "Payment failed"}`);

    if (error.response) {
      console.error("   Status:", error.response.status);

      // Show payment options if 402
      if (error.response.status === 402 && error.response.data.accepts) {
        console.log("\n💡 Available payment options:");
        error.response.data.accepts.forEach((accept: any, i: number) => {
          console.log(
            `   ${i + 1}. ${accept.network} - Pay to: ${accept.payTo}`,
          );
        });
      }
    } else {
      console.error("   Error:", error.message);
    }
    process.exit(1);
  }
}

main();
