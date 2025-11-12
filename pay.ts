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
if (!args.receiver_identity || !args.receiver || !args.amount) {
  console.error("Usage: yarn pay --receiver_identity <receiver_identity> --receiver <receiver> --amount <amount> [--network <base|solana>]");
  console.error("\nExamples:");
  console.error("  yarn pay --receiver_identity x --receiver 0xmesuthere --amount 0.01");
  console.error("  yarn pay --receiver_identity farcaster --receiver toly --amount 0.01");
  console.error("  yarn pay --receiver_identity github --receiver 0xsnackbaker --amount 0.01");
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
const amount = parseFloat(args.amount);
if (isNaN(amount)) {
  console.error("Amount must be a valid number, e.g., 0.01");
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

  console.log(`\n💸 Sending payment to ${args.receiver_identity}:${args.receiver} (${amount} USDC)...`);
  console.log(`   Using endpoint: ${baseURL}/payments/${args.receiver_identity}/pay`);
  console.log(`   Network: ${useSolana ? (network === 'solana' ? 'Solana Mainnet' : 'Solana Devnet') : 'Base'}\n`);

  try {
    const response = await api.post(`/payments/${args.receiver_identity}/pay`, {
      amount,
      currency: "USDC",
      receiver: args.receiver,
      description: `Payment via X402 (${useSolana ? 'Solana' : 'Ethereum'})`
    });

    console.log(`✅ ${response.data?.msg || 'Payment sent'} | 💰 ${amount} USDC → ${args.receiver}`);
    
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
    console.log(`❌ ${error.response?.data?.msg || 'Payment failed'}`);
    
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
