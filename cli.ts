#!/usr/bin/env node

/**
 * Snack Money CLI
 * Send USDC payments via Snack Money API using x402 protocol
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const VERSION = packageJson.version;

const commands = {
  pay: "pay.js",
  "batch-pay": "batch_pay.js",
  "ai-agent": "ai-payment-agent.js",
};

function showVersion() {
  console.log(`snackmoney v${VERSION}`);
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🍪 Snack Money CLI                        ║
╚═══════════════════════════════════════════════════════════════╝

Send USDC payments on Solana via Snack Money API using x402 protocol

USAGE:
  snackmoney <command> [options]

COMMANDS:
  pay                           Send payment to a single receiver on Solana
  batch-pay                     Send batch payments to multiple receivers on Solana
  ai-agent                      AI-powered payment agent with natural language

EXAMPLES:

  # Single payment to X user
  snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.01

  # Single payment to Farcaster user
  snackmoney pay --receiver_identity farcaster --receiver mesut --amount 0.01

  # Batch payment to multiple X users
  snackmoney batch-pay --receiver_identity x --receivers '[{"receiver":"0xmesuthere","amount":0.5},{"receiver":"aeyakovenko","amount":0.25}]'

  # AI-powered payment across platforms
  snackmoney ai-agent --prompt "Send 1 USDC to @toly on Farcaster and 0.5 USDC to @aeyakovenko on X"

OPTIONS:
  --help, -h       Show this help message
  --version, -v    Show version number

ENVIRONMENT VARIABLES:
  SVM_PRIVATE_KEY       Your Solana private key (required)
  ANTHROPIC_API_KEY     Claude API key (optional, for ai-agent)
  OPENAI_API_KEY        OpenAI API key (optional, for ai-agent)

DOCUMENTATION:
  https://docs.snack.money
  https://github.com/snack-money/snackmoney-cli

`);
}

function runCommand(command: string, args: string[]) {
  const scriptPath = join(__dirname, command);

  const child = spawn("node", [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`Failed to start command: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    showVersion();
    process.exit(0);
  }

  const command = args[0];

  if (command in commands) {
    const commandFile = commands[command as keyof typeof commands];
    const commandArgs = args.slice(1);
    runCommand(commandFile, commandArgs);
  } else {
    console.error(`\n❌ Unknown command: ${command}\n`);
    console.error(`Run 'snackmoney --help' to see available commands.\n`);
    process.exit(1);
  }
}

main();
