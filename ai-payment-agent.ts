/**
 * AI Payment Agent with x402 integration
 *
 * This agent combines:
 * - Natural language payment processing using Claude
 * - Snack Money API for social payments
 * - Support for both Ethereum (Base) and Solana networks
 *
 * Example usage:
 *   yarn ai-agent --prompt "Send 1 USDC to @toly on Farcaster and 0.5 USDC to @aeyakovenko on X"
 *   yarn ai-agent --prompt "Pay @mesut 0.5 USDC on Farcaster"
 */

import minimist from "minimist";
import axios from "axios";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor, createSigner } from "x402-axios";

const privateKey = process.env.EVM_PRIVATE_KEY as Hex;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "https://api.snack.money";
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const args = minimist(process.argv.slice(2));

// Validate network parameter if provided
const allowedNetworks = ["base", "solana"];

// Check which private keys are available
const hasEvmKey = !!privateKey;
const hasSvmKey = !!svmPrivateKey;

// Debug: Show which keys are detected
if (process.env.DEBUG) {
  console.log(`🔍 Debug: EVM_PRIVATE_KEY = ${hasEvmKey ? "SET" : "NOT SET"}`);
  console.log(`🔍 Debug: SVM_PRIVATE_KEY = ${hasSvmKey ? "SET" : "NOT SET"}`);
}

// Determine network based on provided arg or auto-detect
let useSolana: boolean;

if (args.network) {
  // Network explicitly specified
  if (!allowedNetworks.includes(args.network.toLowerCase())) {
    console.error(
      `❌ network must be either ${allowedNetworks.map((n) => `'${n}'`).join(" or ")}`,
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

if (!anthropicApiKey && !openaiApiKey) {
  console.error("⚠️  Warning: No AI API key set. AI features will be limited.");
  console.error(
    "   Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable for better parsing.",
  );
}

if (!args.prompt) {
  console.error(
    'Usage: yarn ai-agent --prompt "<your payment request>" [--network <base|solana>]',
  );
  console.log("\nExamples:");
  console.log(
    '  yarn ai-agent --prompt "Send 1 USDC to @toly on Farcaster and 0.5 USDC to @aeyakovenko on X"',
  );
  console.log('  yarn ai-agent --prompt "Pay @mesut 0.5 USDC on Farcaster"');
  console.log(
    '  yarn ai-agent --prompt "Send 0.25 USDC tip to @0xmesuthere on X"',
  );
  console.log(
    "\nNote: If --network is not specified, it will be auto-detected based on available private keys.",
  );
  console.log(
    "      If both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY are set, you must specify --network.",
  );
  process.exit(1);
}

interface PaymentInstruction {
  receiver: string;
  amount: number;
  platform: "x" | "farcaster" | "web" | "email" | "github";
  description?: string;
}

/**
 * AI Tool: Execute a payment via Snack Money
 */
async function executePayment(instruction: PaymentInstruction): Promise<any> {
  let api;
  let network;

  if (useSolana) {
    // Use mainnet for production, devnet for local development
    network =
      baseURL?.includes("localhost") || baseURL?.includes("127.0.0.1")
        ? "solana-devnet"
        : "solana";

    const signer = await createSigner(network, svmPrivateKey);
    api = withPaymentInterceptor(axios.create({ baseURL }), signer);
  } else {
    network = "base";
    const account = privateKeyToAccount(privateKey);
    api = withPaymentInterceptor(axios.create({ baseURL }), account as never);
  }

  console.log(
    `💰 Paying: ${instruction.amount} USDC → @${instruction.receiver} (${instruction.platform}) on ${useSolana ? "Solana" : "Base"}`,
  );

  try {
    const response = await api.post(`/payments/${instruction.platform}/pay`, {
      amount: instruction.amount,
      currency: "USDC",
      receiver: instruction.receiver,
      description:
        instruction.description ||
        `Payment via AI Agent (${useSolana ? "Solana" : "Ethereum"})`,
    });

    // Display detailed receipt
    displayReceipt(response, {
      amount: instruction.amount,
      currency: "USDC",
      receiver: instruction.receiver,
      receiver_identity: instruction.platform,
      description: instruction.description || "Payment via AI Agent",
    });

    return response.data;
  } catch (error: any) {
    console.error("\n❌ PAYMENT FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.error("Network error - no response received");
    } else {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * AI Tool: Execute batch payments
 */
async function executeBatchPayment(
  platform: PaymentInstruction["platform"],
  receivers: Array<{ receiver: string; amount: number }>,
): Promise<any> {
  let api;
  let network;

  if (useSolana) {
    // Use mainnet for production, devnet for local development
    network =
      baseURL?.includes("localhost") || baseURL?.includes("127.0.0.1")
        ? "solana-devnet"
        : "solana";

    const signer = await createSigner(network, svmPrivateKey);
    api = withPaymentInterceptor(axios.create({ baseURL }), signer);
  } else {
    network = "base";
    const account = privateKeyToAccount(privateKey);
    api = withPaymentInterceptor(axios.create({ baseURL }), account as never);
  }

  console.log(
    `💰 Batch paying ${receivers.length} recipients on ${platform} using ${useSolana ? "Solana" : "Base"}`,
  );

  const totalAmount = receivers.reduce(
    (sum, receiver) => sum + receiver.amount,
    0,
  );

  try {
    const response = await api.post(`/payments/${platform}/batch-pay`, {
      currency: "USDC",
      type: "social-network",
      sender_username: "ai-payment-agent",
      receivers,
    });

    // Display detailed batch receipt
    displayBatchReceipt(response, {
      receivers,
      receiver_identity: platform,
      currency: "USDC",
      totalAmount,
    });

    return response.data;
  } catch (error: any) {
    console.error("\n❌ BATCH PAYMENT FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.error("Network error - no response received");
    } else {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse natural language payment request using AI (Claude or OpenAI)
 */
async function parsePaymentRequest(
  prompt: string,
): Promise<PaymentInstruction[]> {
  // Try OpenAI first if available, then Claude, then fallback
  if (openaiApiKey) {
    return parseWithOpenAI(prompt);
  } else if (anthropicApiKey) {
    return parseWithClaude(prompt);
  } else {
    // Fallback: Simple regex-based parsing
    console.log(
      "⚠️  Using regex parser. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for AI parsing.",
    );
    return fallbackParser(prompt);
  }
}

/**
 * Parse using OpenAI
 */
async function parseWithOpenAI(prompt: string): Promise<PaymentInstruction[]> {
  console.log("🤖 OpenAI parsing...");

  const systemPrompt = `You are a payment assistant. Parse payment requests and extract structured payment instructions.

Supported platforms: x, farcaster, web, email, github

Return ONLY valid JSON array of payment instructions. Each instruction must have:
- receiver: username (without @ prefix)
- amount: number
- platform: one of the supported platforms
- description: optional string

Example output:
[
  {"receiver": "alice", "amount": 0.5, "platform": "farcaster", "description": "Thanks for the help!"},
  {"receiver": "bob", "amount": 1.0, "platform": "x"}
]

If you cannot parse valid payment instructions, return an empty array [].`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Request: "${prompt}"` },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  return parseAIResponse(content, "OpenAI");
}

/**
 * Parse using Claude
 */
async function parseWithClaude(prompt: string): Promise<PaymentInstruction[]> {
  console.log("🤖 Claude parsing...");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a payment assistant. Parse this payment request and extract structured payment instructions.

Supported platforms: x, farcaster, web, email, github

Request: "${prompt}"

Return ONLY valid JSON array of payment instructions. Each instruction must have:
- receiver: username (without @ prefix)
- amount: number
- platform: one of the supported platforms
- description: optional string

Example output:
[
  {"receiver": "alice", "amount": 0.5, "platform": "farcaster", "description": "Thanks for the help!"},
  {"receiver": "bob", "amount": 1.0, "platform": "x"}
]

If you cannot parse valid payment instructions, return an empty array [].`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  return parseAIResponse(content, "Claude");
}

/**
 * Parse AI response and extract JSON
 */
function parseAIResponse(
  content: string,
  provider: string,
): PaymentInstruction[] {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(
      `❌ Could not parse ${provider} response. Raw response:`,
      content,
    );
    console.log("⚠️  Using regex fallback...");
    return fallbackParser(content);
  }

  const instructions = JSON.parse(jsonMatch[0]);

  // Display parsed instructions
  console.log(
    `📋 Found ${instructions.length} payment(s):`,
    instructions
      .map(
        (inst: PaymentInstruction) =>
          `${inst.amount} USDC → @${inst.receiver} (${inst.platform})`,
      )
      .join(", "),
  );

  return instructions;
}

/**
 * Fallback parser for when Claude API is not available
 */
function fallbackParser(prompt: string): PaymentInstruction[] {
  const instructions: PaymentInstruction[] = [];

  // Simple regex patterns
  const patterns = [
    // "Send X USDC to @user on platform"
    /send\s+(\d+\.?\d*)\s+usdc\s+to\s+@?(\w+)\s+on\s+(x|farcaster|web|email|github)/gi,
    // "Pay @user X USDC on platform"
    /pay\s+@?(\w+)\s+(\d+\.?\d*)\s+usdc\s+on\s+(x|farcaster|web|email|github)/gi,
    // "@user on platform X USDC"
    /@?(\w+)\s+on\s+(x|farcaster|web|email|github)\s+(\d+\.?\d*)\s+usdc/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      if (pattern.source.includes("send")) {
        instructions.push({
          receiver: match[2],
          amount: parseFloat(match[1]),
          platform: match[3].toLowerCase() as any,
        });
      } else if (pattern.source.includes("pay")) {
        instructions.push({
          receiver: match[1],
          amount: parseFloat(match[2]),
          platform: match[3].toLowerCase() as any,
        });
      } else {
        instructions.push({
          receiver: match[1],
          amount: parseFloat(match[3]),
          platform: match[2].toLowerCase() as any,
        });
      }
    }
  }

  if (instructions.length > 0) {
    console.log(
      `📋 Found ${instructions.length} payment(s):`,
      instructions
        .map(
          (inst) =>
            `${inst.amount} USDC → @${inst.receiver} (${inst.platform})`,
        )
        .join(", "),
    );
  }

  return instructions;
}

/**
 * Main execution
 */
async function main() {
  const networkName = useSolana
    ? baseURL?.includes("localhost") || baseURL?.includes("127.0.0.1")
      ? "Solana Devnet"
      : "Solana Mainnet"
    : "Base";

  console.log(`🚀 AI Agent: "${args.prompt}"`);
  console.log(`🌐 Network: ${networkName}\n`);

  try {
    // Step 1: Parse the payment request
    const instructions = await parsePaymentRequest(args.prompt);

    if (instructions.length === 0) {
      console.log(
        "❌ No valid payment instructions found. Try: 'Send 0.5 USDC to alice on farcaster'",
      );
      process.exit(1);
    }

    // Step 2: Group by platform for batch processing
    const byPlatform = instructions.reduce(
      (acc, inst) => {
        if (!acc[inst.platform]) acc[inst.platform] = [];
        acc[inst.platform].push({
          receiver: inst.receiver,
          amount: inst.amount,
        });
        return acc;
      },
      {} as Record<string, Array<{ receiver: string; amount: number }>>,
    );

    // Step 3: Execute payments
    console.log("\n💳 Processing payments...");
    console.log("━".repeat(60));

    for (const [platform, receivers] of Object.entries(byPlatform)) {
      if (receivers.length === 1) {
        // Single payment
        const inst = instructions.find(
          (i) =>
            i.platform === platform && i.receiver === receivers[0].receiver,
        )!;
        await executePayment(inst);
      } else {
        // Batch payment
        await executeBatchPayment(platform as any, receivers);
      }
    }

    console.log("\n✅ All payments completed successfully!");
    console.log("━".repeat(60));
  } catch (error: any) {
    console.error("\n💥 Error:", error.message);
    process.exit(1);
  }
}

function displayReceipt(response: any, paymentDetails: any) {
  console.log(
    `✅ ${response.data?.msg || "Payment sent"} | 💰 ${paymentDetails.amount} ${paymentDetails.currency} → ${paymentDetails.receiver}`,
  );
  if (response.data?.txn_id) console.log(`� TXN: ${response.data.txn_id}`);
  if (response.data?.receipt)
    console.log(`� Receipt: ${response.data.receipt}`);
}

function displayBatchReceipt(response: any, paymentDetails: any) {
  console.log(
    `✅ ${response.data?.msg || "Batch payment sent"} | 💰 ${paymentDetails.totalAmount} ${paymentDetails.currency} → ${paymentDetails.receivers.length} recipients`,
  );
  if (response.data?.txn_id) console.log(`� TXN: ${response.data.txn_id}`);
  if (response.data?.receipt)
    console.log(`� Receipt: ${response.data.receipt}`);
}

main();
