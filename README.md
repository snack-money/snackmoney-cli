# 🍪 Snack Money CLI

A command-line tool for sending USDC payments and creating cookie campaigns via the [**Snack Money API**](https://docs.snack.money/api-reference/introduction) to any **X**, **Github** or **Farcaster** user on **Solana** or **Base** — no wallet address required, thanks to the **x402 protocol**.

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
   npx snackmoney pay x/aeyakovenko 1¢
   ```

   On Base:

   ```bash
   npx snackmoney pay x/jessepollak $0.5
   ```

## 📖 Commands

### `pay` - Send Single Payment

```bash
snackmoney pay <platform/username> <amount> [--network <base|solana>]
```

**Examples:**

```bash
# Send to X users
snackmoney pay x/aeyakovenko 1¢
snackmoney pay x.com/jessepollak $0.5
snackmoney pay twitter.com/0xmesuthere 50¢

# Send to Farcaster user
snackmoney pay farcaster.xyz/toly $1

# Send to GitHub user
snackmoney pay github.com/0xsnackbaker 0.01

# Send to email
snackmoney pay email/mesut@snack.money $0.25

# Send to web domain
snackmoney pay web/snack.money 0.5
```

**Supported platforms:**

- `x`, `x.com`, `twitter`, `twitter.com` - X/Twitter
- `farcaster`, `farcaster.xyz` - Farcaster
- `github`, `github.com` - GitHub
- `email` - Email addresses
- `web` - Web domains

**Amount formats:**

- `1¢`, `50¢` - Cents notation
- `$0.5`, `$1` - Dollar notation
- `0.5`, `0.01` - Decimal notation

### `batch-pay` - Send Batch Payments

Send payments to multiple users at once using comma-separated format, JSON file, or URL.

**Format 1: Comma-separated**

```bash
snackmoney batch-pay <platform/user1:amount1,user2:amount2,...> [--network <base|solana>]
```

**Examples:**

```bash
# Solana
snackmoney batch-pay x/aeyakovenko:7¢,0xMert_:3¢,0xmesuthere:5¢ --network solana

# Base
snackmoney batch-pay x/MurrLincoln:2¢,kleffew94:9¢,jessepollak:4¢,0xmesuthere:6¢ --network base

# With domain extensions
snackmoney batch-pay twitter.com/user1:1¢,user2:$0.5
snackmoney batch-pay farcaster.xyz/toly:50¢,mesut:25¢
```

**Format 2: From file**

```bash
snackmoney batch-pay ./examples/payments-solana.json
snackmoney batch-pay ./examples/payments-base.json
snackmoney batch-pay file:./payments.json
```

**Format 3: From URL**

```bash
snackmoney batch-pay https://example.com/payments.json
snackmoney batch-pay http://localhost:3000/payments.json
```

**Format 4: JSON string**

```bash
snackmoney batch-pay '{"platform":"x","payments":[{"receiver":"aeyakovenko","amount":"1¢"}]}'
```

**JSON file format:**

```json
{
  "platform": "x",
  "payments": [
    { "receiver": "aeyakovenko", "amount": "7¢" },
    { "receiver": "0xMert_", "amount": "3¢" },
    { "receiver": "0xmesuthere", "amount": "5¢" }
  ]
}
```

See example files:

- [`examples/payments-solana.json`](examples/payments-solana.json)
- [`examples/payments-base.json`](examples/payments-base.json)

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

### `create-campaign` - Create Cookie Campaigns

Create cookie campaigns on X (Twitter) or Farcaster platforms. Campaigns distribute free "cookies" (USDC tokens) to users who interact with your campaign.

```bash
snackmoney create-campaign <json-input> [--network <base|solana>]
```

**JSON Input Options:**

- Local file: `./campaign.json`
- URL: `https://example.com/campaign.json`
- Inline JSON: `'{"platform":"x",...}'`

**Required Fields:**

| Field | Type | Requirements | Description |
|-------|------|--------------|-------------|
| `platform` | string | "x" or "farcaster" | Campaign platform |
| `name` | string | 3-100 characters | Campaign name |
| `description` | string | 10-500 characters | Campaign description |
| `totalCookies` | number | 3-10 (integer) | Number of cookies to distribute |
| `sponsor.name` | string | 1-100 characters | Sponsor name |
| `sponsor.handle` | string | 1-50 characters | Sponsor handle (without @) |
| `sponsor.url` | string | Valid URL (optional) | Sponsor website |

**Examples:**

```bash
# From JSON file
snackmoney create-campaign ./campaign.json

# From URL
snackmoney create-campaign https://example.com/campaign.json

# Inline JSON
snackmoney create-campaign '{"platform":"x","name":"Free Cookies","description":"Send cookies to friends!","totalCookies":5,"sponsor":{"name":"Snack","handle":"snackmoney"}}'
```

**JSON Format:**

```json
{
  "platform": "x",
  "name": "5 Free Cookies Campaign",
  "description": "Send free cookies to your friends on X and build community!",
  "totalCookies": 5,
  "sponsor": {
    "name": "Snack Money",
    "handle": "snackmoneyapp",
    "url": "https://snack.money"
  }
}
```

**Example Files:**

- [`examples/campaign-x.json`](examples/campaign-x.json) - X/Twitter campaign
- [`examples/campaign-farcaster.json`](examples/campaign-farcaster.json) - Farcaster campaign

**How it works:**

1. Parse and validate campaign data
2. Calculate total cost (cookies × cookie value)
3. Prompt for payment confirmation
4. Process payment via x402 protocol
5. Create campaign (queued or active)
6. Return campaign details and detail page URL

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

- **x, x.com, twitter, twitter.com** - X (formerly Twitter)
- **farcaster, farcaster.xyz** - Farcaster social network
- **github, github.com** - GitHub
- **email** - Email addresses
- **web** - Web domains

## 🛠️ Development

### Prerequisites

- **Node.js v20+** (Install via [nvm](https://github.com/nvm-sh/nvm))
- **Yarn**
- **Private key**: `SVM_PRIVATE_KEY` (for Solana) or `EVM_PRIVATE_KEY` (for Base)

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
yarn pay x/aeyakovenko 1¢ --network solana

# X user on Base
yarn pay x/jessepollak $0.5 --network base

# Farcaster user
yarn pay farcaster.xyz/toly 0.01

# GitHub user
yarn pay github.com/0xsnackbaker $1
```

#### Batch Payments

```bash
# Solana - Comma-separated
yarn batch-pay x/aeyakovenko:7¢,0xMert_:3¢,0xmesuthere:5¢ --network solana

# Base - Comma-separated
yarn batch-pay x/MurrLincoln:2¢,kleffew94:9¢,jessepollak:4¢,0xmesuthere:6¢ --network base

# From file
yarn batch-pay ./examples/payments-solana.json

# From URL
yarn batch-pay https://example.com/payments.json
```

#### AI Agent

```bash
yarn ai-agent --prompt "Send 1 USDC to @mesut on Farcaster and 0.5 USDC to @aeyakovenko on X"
```

#### Create Campaigns

```bash
# From file
yarn tsx create-campaign.ts ./examples/campaign-x.json

# Inline JSON
yarn tsx create-campaign.ts '{"platform":"farcaster","name":"Test Campaign","description":"This is a test campaign","totalCookies":5,"sponsor":{"name":"Snack","handle":"snackmoney"}}'
```

## 📝 Notes

- Payments can be processed on **Solana** or **Base** networks
- Use platform identifiers: `x`, `farcaster`, `github`, `email`, or `web` (with optional domain extensions)
- All amount formats supported: cents (`1¢`), dollars (`$0.5`), or decimal (`0.5`)
- For Solana payments: Ensure your `SVM_PRIVATE_KEY` is secure and your address is funded with sufficient USDC on Solana
- For Base payments: Ensure your `EVM_PRIVATE_KEY` is secure and your address is funded with sufficient USDC on Base
- Network is auto-detected based on which private key is set (or specify with `--network` flag)

## 📚 Documentation

- API Documentation: https://docs.snack.money
- GitHub Repository: https://github.com/snack-money/snackmoney-cli

## 📄 License

MIT

---

**Happy sending! 🍪💸**
