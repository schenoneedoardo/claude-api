<div align="center">

# 🔮 Claude Proxy

### Use Claude as a free API, without paying per token.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

<img src="https://img.shields.io/badge/Anthropic-Claude-6B4FBB?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude"/>
<img src="https://img.shields.io/badge/API-Compatible-00C853?style=for-the-badge" alt="API Compatible"/>
<img src="https://img.shields.io/badge/Dashboard-Included-FF6D00?style=for-the-badge" alt="Dashboard"/>

<br/><br/>

> If you have a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) subscription, this proxy lets you use Claude as a standard API — compatible with any app, script, or tool that supports the Anthropic API format.

</div>

<br/>

---

<br/>

## ✨ What is this for?

<table>
<tr>
<td>🔗</td>
<td><strong>Connect Claude to any application</strong> — Cursor, Continue, LibreChat, Python scripts, Telegram bots... without a paid API key</td>
</tr>
<tr>
<td>🧪</td>
<td><strong>Build and test</strong> AI integrations without spending on tokens</td>
</tr>
<tr>
<td>📊</td>
<td><strong>Monitor everything</strong> from a real-time web dashboard</td>
</tr>
<tr>
<td>⚙️</td>
<td><strong>Change configuration on the fly</strong> directly from the browser</td>
</tr>
</table>

<br/>

## 🔄 How it works

```
┌──────────┐      ┌───────────────┐      ┌────────────────┐      ┌──────────────┐
│ Your App │ ───▶ │ Claude Proxy  │ ───▶ │ Claude Code CLI│ ───▶ │ AI Response  │
│  (HTTP)  │ ◀─── │  (localhost)  │ ◀─── │   (claude -p)  │ ◀─── │   (Claude)   │
└──────────┘      └───────────────┘      └────────────────┘      └──────────────┘
```

1. 📤 Your app sends an HTTP request (identical to the Anthropic API)
2. 🔀 The proxy translates it into a Claude CLI command
3. 🤖 Claude responds through the CLI
4. 📥 The proxy converts the response back to standard Anthropic format

> **From your app's perspective, nothing changes** — it's like talking directly to the Anthropic API.

<br/>

---

<br/>

## 📋 Requirements

| Requirement | Version | Notes |
|:-----------:|:-------:|:------|
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white) | 20+ | Runtime |
| ![pnpm](https://img.shields.io/badge/-pnpm-F69220?logo=pnpm&logoColor=white) | Latest | Or npm |
| ![Claude](https://img.shields.io/badge/-Claude_Code-6B4FBB?logo=anthropic&logoColor=white) | Latest | Must be authenticated |

<br/>

## 🚀 Installation

```bash
# 1. Clone and install dependencies
cd claude-proxy
pnpm install

# 2. Create the config file
cp .env.example .env

# 3. Start the server
pnpm dev
```

> 🟢 The proxy will be running at `http://localhost:3456`

<br/>

## 🖥️ Dashboard

Open **`http://localhost:3456/dashboard`** in your browser.

<table>
<tr>
<td width="50%">

### 📊 Monitor
Real-time metrics at a glance:
- Request queue & active requests
- Completed requests & errors
- Circuit breaker status
- Rate limit usage
- Uptime

</td>
<td width="50%">

### ⚙️ Configuration
Edit all settings live from the browser:
- Rate limiting & concurrency
- Timeouts & queue size
- Circuit breaker thresholds
- Provider & log level
- API key

> Changes are saved instantly to `.env`

</td>
</tr>
</table>

<br/>

---

<br/>

## 💡 Usage examples

### 📨 Basic request

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello Claude!"}
    ]
  }'
```

### 🌊 Streaming (real-time response)

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -N \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Write a haiku about code"}
    ]
  }'
```

### 📋 List available models

```bash
curl http://localhost:3456/v1/models -H "x-api-key: your-key"
```

<br/>

## 🛠️ Configuration

All settings live in the `.env` file (or change them from the dashboard):

| Variable | Default | What it does |
|:---------|:-------:|:-------------|
| `PORT` | `3456` | Server port |
| `HOST` | `127.0.0.1` | Server bind address |
| `PROXY_API_KEY` | *(empty)* | Key to protect the proxy (empty = open access) |
| `PROVIDER` | `cli` | Provider type (`cli` for now) |
| `CLAUDE_CLI_PATH` | `claude` | Path to the Claude Code executable |
| `MAX_REQUESTS_PER_MINUTE` | `10` | Rate limit (requests per minute) |
| `MAX_CONCURRENT_REQUESTS` | `2` | Max parallel requests |
| `QUEUE_MAX_SIZE` | `50` | Queued requests before rejecting |
| `REQUEST_TIMEOUT_MS` | `120000` | Request timeout in milliseconds |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Consecutive failures before tripping |
| `CIRCUIT_BREAKER_COOLDOWN_MS` | `60000` | Cooldown after circuit opens |
| `LOG_LEVEL` | `info` | Log level |

<br/>

## 🌐 API Endpoints

| Method | Path | Description |
|:------:|:-----|:------------|
| `POST` | `/v1/messages` | 💬 Anthropic Messages API (sync + streaming) |
| `GET` | `/v1/models` | 📋 List available models |
| `GET` | `/health` | 💚 Health check + queue stats |
| `GET` | `/dashboard` | 🖥️ Web dashboard for monitoring & config |

<br/>

## ⚠️ Limitations

| | Limitation | Details |
|:-:|:-----------|:--------|
| 🚦 | **Rate limits** | Consumer accounts have usage limits. The proxy adds its own configurable rate limiting to stay within them |
| 💬 | **No persistent sessions** | Each request spawns a new CLI process. Conversation history must be passed each time in the `messages` field |
| ⏱️ | **Streaming latency** | Streaming works but may have a small initial delay from the CLI |
| 🎯 | **Model availability** | Depends on your Claude Code subscription tier |
| 🖼️ | **No image input** | Image content blocks are converted to text descriptions |

<br/>

## 🐳 Docker

```bash
# Build
docker build -t claude-proxy .

# Run (mount Claude credentials)
docker run -p 3456:3456 \
  -v ~/.claude:/home/node/.claude:ro \
  -e PROXY_API_KEY=your-key \
  claude-proxy
```

> ℹ️ Claude Code CLI must be installed inside the Docker image or mounted as a volume.

<br/>

## 📁 Project structure

```
src/
├── 📄 index.ts              # Entry point
├── 📄 server.ts             # Fastify server + routes + dashboard
├── 📁 config/
│   └── index.ts             # Environment configuration
├── 📁 routes/
│   ├── messages.ts          # POST /v1/messages
│   ├── models.ts            # GET /v1/models
│   └── health.ts            # GET /health
├── 📁 providers/
│   ├── base.ts              # Provider interface
│   └── cli-wrapper.ts       # Claude Code CLI wrapper
├── 📁 queue/
│   ├── rate-limiter.ts      # Token bucket + circuit breaker
│   └── request-queue.ts     # FIFO queue with concurrency control
├── 📁 mappers/
│   ├── request-mapper.ts    # Request types + prompt builder
│   └── response-mapper.ts   # CLI output → API response mapper
├── 📁 streaming/
│   └── sse-handler.ts       # Server-Sent Events handler
└── 📁 utils/
    ├── logger.ts            # Pino logger
    └── errors.ts            # Custom error types
```

<br/>

---

<br/>

## 💬 Contact

<div align="center">

Got questions? Reach out on Discord!

[![Discord](https://img.shields.io/badge/Discord-edoquellovero.-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com)

</div>

<br/>

## ⚖️ Disclaimer

> This project is meant for **personal use and development only**. It is not designed for production. It relies on Claude Code's consumer account authentication, which has strict rate limits and usage policies. Use responsibly and in accordance with [Anthropic's Terms of Service](https://www.anthropic.com/terms).

<br/>

<div align="center">

## 📄 License

MIT

<br/>

Made with 🔮 by leveraging Claude Code

</div>
