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
import { createInterface } from "readline";

const privateKey = process.env.EVM_PRIVATE_KEY as Hex;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "https://api.snack.money";

/**
 * Campaign creation data structure
 */
interface CampaignData {
  platform: "x" | "farcaster";
  name: string;
  description: string;
  totalCookies: number;
  sponsor: {
    name: string;
    handle: string;
    url?: string;
  };
}

/**
 * Validate campaign data against API requirements
 */
function validateCampaignData(data: any): CampaignData {
  const errors: string[] = [];

  // Validate platform
  if (!data.platform) {
    errors.push("platform is required (must be 'x' or 'farcaster')");
  } else if (!["x", "farcaster"].includes(data.platform)) {
    errors.push(`platform must be 'x' or 'farcaster', got: ${data.platform}`);
  }

  // Validate name
  if (!data.name) {
    errors.push("name is required");
  } else if (typeof data.name !== "string") {
    errors.push("name must be a string");
  } else if (data.name.length < 3) {
    errors.push("name must be at least 3 characters");
  } else if (data.name.length > 100) {
    errors.push("name must be at most 100 characters");
  }

  // Validate description
  if (!data.description) {
    errors.push("description is required");
  } else if (typeof data.description !== "string") {
    errors.push("description must be a string");
  } else if (data.description.length < 10) {
    errors.push("description must be at least 10 characters");
  } else if (data.description.length > 500) {
    errors.push("description must be at most 500 characters");
  }

  // Validate totalCookies
  if (data.totalCookies === undefined || data.totalCookies === null) {
    errors.push("totalCookies is required");
  } else if (typeof data.totalCookies !== "number") {
    errors.push("totalCookies must be a number");
  } else if (!Number.isInteger(data.totalCookies)) {
    errors.push("totalCookies must be an integer");
  } else if (data.totalCookies < 3) {
    errors.push("totalCookies must be at least 3");
  } else if (data.totalCookies > 10) {
    errors.push("totalCookies must be at most 10");
  }

  // Validate sponsor
  if (!data.sponsor) {
    errors.push("sponsor is required");
  } else {
    if (!data.sponsor.name) {
      errors.push("sponsor.name is required");
    } else if (typeof data.sponsor.name !== "string") {
      errors.push("sponsor.name must be a string");
    } else if (data.sponsor.name.length < 1) {
      errors.push("sponsor.name must be at least 1 character");
    } else if (data.sponsor.name.length > 100) {
      errors.push("sponsor.name must be at most 100 characters");
    }

    if (!data.sponsor.handle) {
      errors.push("sponsor.handle is required");
    } else if (typeof data.sponsor.handle !== "string") {
      errors.push("sponsor.handle must be a string");
    } else if (data.sponsor.handle.length < 1) {
      errors.push("sponsor.handle must be at least 1 character");
    } else if (data.sponsor.handle.length > 50) {
      errors.push("sponsor.handle must be at most 50 characters");
    }

    // Validate URL if provided
    if (data.sponsor.url !== undefined && data.sponsor.url !== null) {
      if (typeof data.sponsor.url !== "string") {
        errors.push("sponsor.url must be a string");
      } else {
        try {
          new URL(data.sponsor.url);
        } catch {
          errors.push(`sponsor.url must be a valid URL: ${data.sponsor.url}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return data as CampaignData;
}

/**
 * Parse JSON input from various sources:
 * - File path (./campaign.json)
 * - URL (https://example.com/campaign.json)
 * - Inline JSON string
 */
async function parseJsonInput(input: string): Promise<any> {
  // Try to parse as inline JSON first
  if (input.trim().startsWith("{")) {
    try {
      return JSON.parse(input);
    } catch (error: any) {
      throw new Error(`Failed to parse inline JSON: ${error.message}`);
    }
  }

  // Check if it's a URL
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const response = await axios.get(input);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch JSON from URL: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // Treat as file path
  try {
    const fileContent = readFileSync(input, "utf-8");
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${input}`);
    }
    throw new Error(`Failed to read/parse file: ${error.message}`);
  }
}

/**
 * Prompt user for confirmation
 */
function promptConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Get cookie value from API
 */
async function getCookieValue(): Promise<number> {
  try {
    // This would be an API call to get the cookie value
    // For now, we'll use a default value
    // In production, you might want to add an endpoint to fetch this
    return 1; // $1 per cookie (default)
  } catch (error) {
    console.warn("⚠️  Could not fetch cookie value, using default: $1");
    return 1;
  }
}

const args = minimist(process.argv.slice(2));

if (args._.length < 1) {
  console.error(`
Usage: snackmoney sponsor-a-cookie <json-input> [--network <base|solana>]

JSON Input Options:
  ./campaign.json                      Read from local file
  https://example.com/campaign.json    Fetch from URL
  '{"platform":"x",...}'               Inline JSON string

Required JSON Fields:
  platform          "x" or "farcaster"
  name              Campaign name (3-100 characters)
  description       Campaign description (10-500 characters)
  totalCookies      Number of cookies (3-10)
  sponsor.name      Sponsor name (1-100 characters)
  sponsor.handle    Sponsor handle (1-50 characters)
  sponsor.url       Sponsor URL (optional)

Example JSON:
{
  "platform": "x",
  "name": "5 Free Cookies Campaign",
  "description": "Send free cookies to your friends and build community!",
  "totalCookies": 5,
  "sponsor": {
    "name": "Snack Money",
    "handle": "snackmoneyapp",
    "url": "https://snack.money"
  }
}

Examples:
  snackmoney sponsor-a-cookie ./campaign.json
  snackmoney sponsor-a-cookie https://example.com/campaign.json
  snackmoney sponsor-a-cookie '{"platform":"x","name":"Free Cookies",...}'

Note: If --network is not specified, it will be auto-detected based on available private keys.
`);
  process.exit(1);
}

async function main(): Promise<void> {
  let campaignData: CampaignData;

  // Parse and validate input
  try {
    console.log("\n📝 Parsing campaign data...");
    const rawData = await parseJsonInput(args._[0]);
    campaignData = validateCampaignData(rawData);
    console.log("✅ Campaign data validated successfully\n");
  } catch (error: any) {
    console.error(`❌ ${error.message}\n`);
    process.exit(1);
  }

  // Display campaign details
  console.log("📋 Campaign Details:");
  console.log(`   Platform: ${campaignData.platform.toUpperCase()}`);
  console.log(`   Name: ${campaignData.name}`);
  console.log(`   Description: ${campaignData.description}`);
  console.log(`   Total Cookies: ${campaignData.totalCookies}`);
  console.log(`   Sponsor: ${campaignData.sponsor.name} (@${campaignData.sponsor.handle})`);
  if (campaignData.sponsor.url) {
    console.log(`   Sponsor URL: ${campaignData.sponsor.url}`);
  }

  // Get cookie value and calculate cost
  console.log("\n💰 Calculating campaign cost...");
  const cookieValue = await getCookieValue();
  const totalCost = campaignData.totalCookies * cookieValue;

  console.log(`   Cookie Value: $${cookieValue.toFixed(2)} USDC`);
  console.log(`   Total Cost: ${campaignData.totalCookies} × $${cookieValue.toFixed(2)} = $${totalCost.toFixed(2)} USDC`);

  // Check which private keys are available
  const hasEvmKey = !!privateKey;
  const hasSvmKey = !!svmPrivateKey;
  const allowedNetworks = ["base", "solana"];

  // Determine network based on provided arg or auto-detect
  let useSolana: boolean;

  if (args.network) {
    if (!allowedNetworks.includes(args.network.toLowerCase())) {
      console.error(
        `\n❌ network must be either ${allowedNetworks.map((n) => `'${n}'`).join(" or ")}\n`,
      );
      process.exit(1);
    }

    useSolana = args.network.toLowerCase() === "solana";

    if (useSolana && !hasSvmKey) {
      console.error(
        "\n❌ Missing SVM_PRIVATE_KEY environment variable (needed for --network solana)\n",
      );
      process.exit(1);
    }
    if (!useSolana && !hasEvmKey) {
      console.error(
        "\n❌ Missing EVM_PRIVATE_KEY environment variable (needed for --network base)\n",
      );
      process.exit(1);
    }
  } else {
    if (hasEvmKey && hasSvmKey) {
      console.error(
        "\n❌ Both EVM_PRIVATE_KEY and SVM_PRIVATE_KEY environment variables are set",
      );
      console.error(
        "   Please specify which network to use with --network <base|solana>\n",
      );
      process.exit(1);
    } else if (hasSvmKey) {
      useSolana = true;
      console.log("\nℹ️  Auto-detected network: Solana (based on SVM_PRIVATE_KEY)");
    } else if (hasEvmKey) {
      useSolana = false;
      console.log("\nℹ️  Auto-detected network: Base (based on EVM_PRIVATE_KEY)");
    } else {
      console.error("\n❌ No private keys found in environment variables");
      console.error(
        "   Set either EVM_PRIVATE_KEY (for Base) or SVM_PRIVATE_KEY (for Solana)\n",
      );
      process.exit(1);
    }
  }

  // Confirm payment
  console.log("");
  const confirmed = await promptConfirmation(
    `💳 Proceed with payment of $${totalCost.toFixed(2)} USDC?`,
  );

  if (!confirmed) {
    console.log("\n❌ Campaign creation cancelled\n");
    process.exit(0);
  }

  // Create signer
  let api;
  let network;

  if (useSolana) {
    console.log("\n🔧 Creating Solana signer...");

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

  // Create campaign
  const endpoint = `/campaigns/${campaignData.platform}/create`;
  console.log(`\n🚀 Creating campaign on ${campaignData.platform.toUpperCase()}...`);
  console.log(`   Endpoint: ${baseURL}${endpoint}`);
  console.log(
    `   Network: ${useSolana ? (network === "solana" ? "Solana Mainnet" : "Solana Devnet") : "Base"}\n`,
  );

  try {
    const response = await api.post(endpoint, {
      name: campaignData.name,
      description: campaignData.description,
      totalCookies: campaignData.totalCookies,
      sponsor: campaignData.sponsor,
    });

    console.log("✅ Campaign created successfully!\n");

    const data = response.data?.data;
    if (data) {
      console.log("📊 Campaign Information:");
      console.log(`   Campaign ID: ${data.campaignId}`);
      console.log(`   Status: ${data.status}`);
      if (data.queuePosition) {
        console.log(`   Queue Position: #${data.queuePosition}`);
      }
      if (data.estimatedStartDate) {
        const startDate = new Date(data.estimatedStartDate);
        console.log(`   Estimated Start: ${startDate.toLocaleString()}`);
      }
      console.log(`   Funding Status: ${data.fundingStatus}`);
      if (data.fundingTxnId) {
        console.log(`   Funding Transaction: ${data.fundingTxnId}`);
      }
      console.log(`   Detail Page: ${data.detailPageUrl}`);
    }

    // Show transaction info from headers
    const paymentResponseHeader = response.headers["x-payment-response"];
    if (paymentResponseHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
      console.log(`\n💸 Payment: Network fee paid on ${paymentResponse.network}`);
    }

    console.log("");
  } catch (error: any) {
    console.log(`\n❌ ${error.response?.data?.msg || "Campaign creation failed"}`);

    if (error.response) {
      console.error("   Status:", error.response.status);

      // Show detailed errors if available
      if (error.response.data?.errors) {
        console.log("\n   Validation Errors:");
        const errors = error.response.data.errors;
        if (errors.fields) {
          Object.entries(errors.fields).forEach(([field, messages]) => {
            console.log(`   - ${field}: ${(messages as string[]).join(", ")}`);
          });
        }
      }

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
    console.log("");
    process.exit(1);
  }
}

main();
