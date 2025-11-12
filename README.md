# 🍪 Snack Money CLI

A command-line tool for sending USDC payments via the [**Snack Money API**](https://docs.snack.money/api-reference/introduction) to any **Farcaster** or **X** user on **Solana** — no wallet address required, thanks to the **x402 protocol**.

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

1. **Set up your Solana private key**:
   ```bash
   export SVM_PRIVATE_KEY="your_solana_private_key"
   ```

2. **Send your first payment on Solana**:
   ```bash
   npx snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.01
   ```

## 📖 Commands

### `pay` - Send Single Payment

```bash
snackmoney pay --receiver_identity <identity> --receiver <username> --amount <amount>
```

**Examples:**
```bash
# Send to X user
snackmoney pay --receiver_identity x --receiver 0xmesuthere --amount 0.5

# Send to Farcaster user
snackmoney pay --receiver_identity farcaster --receiver mesut --amount 0.5

# Send to GitHub user
snackmoney pay --receiver_identity github --receiver 0xsnackbaker --amount 0.5
```

### `batch-pay` - Send Batch Payments

```bash
snackmoney batch-pay --receiver_identity <identity> --receivers '<json>'
```

**Examples:**
```bash
# Send to multiple X users
snackmoney batch-pay --receiver_identity x --receivers '[{"receiver":"0xmesuthere","amount":0.5},{"receiver":"aeyakovenko","amount":0.25}]'

# Send to multiple Farcaster users
snackmoney batch-pay --receiver_identity farcaster --receivers '[{"receiver":"toly","amount":0.5},{"receiver":"mesut","amount":0.25}]'
```

### `ai-agent` - AI-Powered Payment Agent

```bash
snackmoney ai-agent --prompt "<natural language request>"
```

**Examples:**
```bash
# Single payment
snackmoney ai-agent --prompt "Send 0.5 USDC to @0xmesuthere on X"

# Multiple payments across platforms
snackmoney ai-agent --prompt "Send 1 USDC to @toly on Farcaster and 0.5 USDC to @aeyakovenko on X"
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
* **Solana private key**: `SVM_PRIVATE_KEY`

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

   Edit `.env` and add your Solana private key:
   ```bash
   SVM_PRIVATE_KEY=your_solana_private_key
   ```

### Usage

#### Single Payment

```bash
# X user
yarn pay --receiver_identity x --receiver 0xmesuthere --amount 0.01

# Farcaster user
yarn pay --receiver_identity farcaster --receiver toly --amount 0.01

# GitHub user
yarn pay --receiver_identity github --receiver 0xsnackbaker --amount 0.01
```

#### Batch Payments

```bash
# Multiple X users
yarn batch-pay --receiver_identity x --receivers '[{"receiver":"0xmesuthere","amount":0.5},{"receiver":"aeyakovenko","amount":0.25}]'

# Multiple Farcaster users
yarn batch-pay --receiver_identity farcaster --receivers '[{"receiver":"toly","amount":0.5},{"receiver":"mesut","amount":0.25}]'
```

#### AI Agent

```bash
yarn ai-agent --prompt "Send 1 USDC to @mesut on Farcaster and 0.5 USDC to @aeyakovenko on X"
```

## 📝 Notes

* All payments are processed on the **Solana** network
* The identity type must match the platform the user is on (farcaster, x, github, email, web)
* Ensure your Solana private key is secure and your address is funded with sufficient USDC on Solana

## 📚 Documentation

- API Documentation: https://docs.snack.money
- GitHub Repository: https://github.com/snack-money/snackmoney-cli

## 📄 License

MIT

---

**Happy sending! 🍪💸**

