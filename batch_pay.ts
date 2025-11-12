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

const args = minimist(process.argv.slice(2));
if (!args.receiver_identity || !args.receivers) {
  console.error("Usage: yarn batch-pay --receiver_identity <receiver_identity> --receivers <receivers_json> [--network <base|solana>]");
  console.error("\nExamples:");
  console.error("  yarn batch-pay --receiver_identity x --receivers '[{\"receiver\":\"0xmesuthere\",\"amount\":0.5},{\"receiver\":\"aeyakovenko\",\"amount\":0.25}]'");
  console.error("  yarn batch-pay --receiver_identity farcaster --receivers '[{\"receiver\":\"toly\",\"amount\":0.5},{\"receiver\":\"mesut\",\"amount\":0.25}]'");
  console.error("\nNote: If --network is not specified, it will be auto-detected based on available private keys.");
  console.error("      If both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY are set, you must specify --network.");
  process.exit(1);
}

// Input validations
const allowedIdentities = ["x", "farcaster", "web", "email", "github"];
if (!allowedIdentities.includes(args.receiver_identity.toLowerCase())) {
  console.error(`receiver_identity must be either ${allowedIdentities.map(i => `'${i}'`).join(" or ")}`);
  process.exit(1);
}

// Parse receivers JSON
let receivers: Array<{receiver: string, amount: number}>;
try {
  receivers = JSON.parse(args.receivers);
  if (!Array.isArray(receivers)) {
    throw new Error("Receivers must be an array");
  }
} catch (e) {
  console.error("❌ Failed to parse receivers JSON");
  console.error("Error:", (e as Error).message);
  console.error("");
  console.error("💡 Use single quotes around the JSON array:");
  console.error("yarn batch-pay --receiver_identity x --receivers '[{\"receiver\":\"0xmesuthere\",\"amount\":0.5},{\"receiver\":\"aeyakovenko\",\"amount\":0.25}]'");
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

  console.log(`\n💸 Sending batch payment to ${receivers.length} recipients on ${args.receiver_identity}...`);
  console.log(`   Using endpoint: ${baseURL}/payments/${args.receiver_identity}/batch-pay`);
  console.log(`   Network: ${useSolana ? (network === 'solana' ? 'Solana Mainnet' : 'Solana Devnet') : 'Base'}\n`);

  try {
    const response = await api.post(`/payments/${args.receiver_identity}/batch-pay`, { 
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

main();
