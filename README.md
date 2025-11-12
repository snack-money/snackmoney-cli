# 🍪 Snack Money CLI

A command-line tool for sending USDC payments via the [**Snack Money API**](https://docs.snack.money/api-reference/introduction) to any **Farcaster** or **X** user on **Solana** or **Base** — no wallet address required, thanks to the **x402 protocol**.

## 📦 Installation

### Via npx (Recommended - No Installation Required)

```bash
npx snackmoney --help
```

### Via npm (Global Installation)

```bash
npm install -g snackmoney
```

### Via Homebrew (macOS/Linux)

```bash
brew tap snack-money/tap
brew install snackmoney
```

## 🚀 Quick Start

1. **Set up your private key**:

   For Solana payments:
   ```bash
   export SVM_PRIVATE_KEY="your_solana_private_key"
   ```

   For Base payments:
   ```bash
   export EVM_PRIVATE_KEY="your_evm_private_key"
   ```

2. **Send your first payment**:

   On Solana:
   ```bash
   npx snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.01 --network solana
   ```

   On Base:
   ```bash
   npx snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.01 --network base
   ```

## 📖 Commands

### `pay` - Send Single Payment

```bash
snackmoney pay --receiver_identity <identity> --receiver <username> --amount <amount> [--network <base|solana>]
```

**Examples:**
```bash
# Send to X user on Solana
snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.5 --network solana

# Send to Farcaster user on Base
snackmoney pay --receiver_identity farcaster --receiver mesut --amount 0.5 --network base

# Send to GitHub user on Solana
snackmoney pay --receiver_identity github --receiver 0xsnackbaker --amount 0.5 --network solana
```

### `batch-pay` - Send Batch Payments

```bash
snackmoney batch-pay --receiver_identity <identity> --receivers '<json>' [--network <base|solana>]
```

**Examples:**
```bash
# Send to multiple X users on Solana
snackmoney batch-pay --receiver_identity x --receivers '[{"receiver":"0xmesuthere","amount":0.5},{"receiver":"aeyakovenko","amount":0.25}]' --network solana

# Send to multiple Farcaster users on Base
snackmoney batch-pay --receiver_identity farcaster --receivers '[{"receiver":"toly","amount":0.5},{"receiver":"mesut","amount":0.25}]' --network base
```

### `ai-agent` - AI-Powered Payment Agent

```bash
snackmoney ai-agent --prompt "<natural language request>"
```

**Examples:**
```bash
# Single payment on Solana
snackmoney ai-agent --prompt "Send 0.5 USDC to @0xmesuthere on X via Solana"

# Single payment on Base
snackmoney ai-agent --prompt "Send 0.5 USDC to @0xmesuthere on X via Base"

# Multiple payments across platforms
snackmoney ai-agent --prompt "Send 1 USDC to @toly on Farcaster and 0.5 USDC to @aeyakovenko on X via Solana"
```

## 🤖 AI Features (Optional)

For natural language payments, set up an AI API key:

```bash
export ANTHROPIC_API_KEY="your_key_here"
# OR
export OPENAI_API_KEY="your_key_here"
```

Then use the AI agent:

```bash
snackmoney ai-agent --prompt "Send 1 USDC to @mesut on Farcaster and 0.5 USDC to @0xmesuthere on X"
```

## 🌐 Supported Platforms

- **farcaster** - Farcaster social network
- **x** - X (formerly Twitter)
- **github** - GitHub
- **email** - Email addresses
- **web** - Web domains

## 🛠️ Development

### Prerequisites

* **Node.js v20+** (Install via [nvm](https://github.com/nvm-sh/nvm))
* **Yarn**
* **Private key**: `SVM_PRIVATE_KEY` (for Solana) or `EVM_PRIVATE_KEY` (for Base)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/snack-money/snackmoney-cli.git
   cd snackmoney-cli
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env-local .env
   ```

   Edit `.env` and add your private key(s):
   ```bash
   # For Solana payments
   SVM_PRIVATE_KEY=your_solana_private_key

   # For Base payments
   EVM_PRIVATE_KEY=your_evm_private_key
   ```

### Usage

#### Single Payment

```bash
# X user on Solana
yarn pay --receiver_identity x --receiver 0xmesuthere --amount 0.01 --network solana

# Farcaster user on Base
yarn pay --receiver_identity farcaster --receiver toly --amount 0.01 --network base

# GitHub user on Solana
yarn pay --receiver_identity github --receiver 0xsnackbaker --amount 0.01 --network solana
```

#### Batch Payments

```bash
# Multiple X users on Solana
yarn batch-pay --receiver_identity x --receivers '[{"receiver":"0xmesuthere","amount":0.5},{"receiver":"aeyakovenko","amount":0.25}]' --network solana

# Multiple Farcaster users on Base
yarn batch-pay --receiver_identity farcaster --receivers '[{"receiver":"toly","amount":0.5},{"receiver":"mesut","amount":0.25}]' --network base
```

#### AI Agent

```bash
yarn ai-agent --prompt "Send 1 USDC to @mesut on Farcaster and 0.5 USDC to @aeyakovenko on X"
```

## 📝 Notes

* Payments can be processed on **Solana** or **Base** networks
* The identity type must match the platform the user is on (farcaster, x, github, email, web)
* For Solana payments: Ensure your `SVM_PRIVATE_KEY` is secure and your address is funded with sufficient USDC on Solana
* For Base payments: Ensure your `EVM_PRIVATE_KEY` is secure and your address is funded with sufficient USDC on Base

## 📚 Documentation

- API Documentation: https://docs.snack.money
- GitHub Repository: https://github.com/snack-money/snackmoney-cli

## 📄 License

MIT

---

**Happy sending! 🍪💸**

