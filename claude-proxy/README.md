# Claude Proxy

**Use Claude as a free API, without paying per token.**

If you have a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) subscription (Anthropic's CLI tool), this proxy lets you use Claude as a standard API — compatible with any app, script, or tool that supports the Anthropic API format.

Instead of paying for Anthropic's pay-per-token API, this proxy leverages your existing Claude Code subscription to handle requests. You send an HTTP call, it forwards it to the Claude CLI, and returns the response in the exact same format as the official Anthropic API.

---

## What is this for?

- **Connect Claude to any application** (Cursor, Continue, LibreChat, Python scripts, Telegram bots...) without a paid API key
- **Build and test** AI integrations without spending on tokens
- **Monitor everything** from a real-time web dashboard
- **Change configuration on the fly** directly from the browser

## How it works (the simple version)

```
Your app  →  Claude Proxy (localhost)  →  Claude Code CLI  →  AI response
```

1. Your app sends an HTTP request (identical to how it would call the Anthropic API)
2. The proxy receives it and translates it into a Claude CLI command
3. Claude responds through the CLI
4. The proxy converts the response back to standard Anthropic format and sends it to your app

From your app's perspective, nothing changes — it's like talking directly to the Anthropic API.

---

## Requirements

- **Node.js** 20+
- **pnpm** (or npm)
- **Claude Code** installed and authenticated (the `claude` command must work from your terminal)

## Installation

```bash
# 1. Clone and install dependencies
cd claude-proxy
pnpm install

# 2. Create the config file
cp .env.example .env

# 3. Start the server
pnpm dev
```

The proxy will be running at `http://localhost:3456`.

## Dashboard

Open `http://localhost:3456/dashboard` in your browser.

The dashboard has two sections:

- **Monitor** — real-time metrics: request queue, active requests, errors, circuit breaker status, uptime
- **Configuration** — edit all proxy settings directly from the browser: rate limiting, concurrency, timeouts, circuit breaker, provider, log level. Changes are saved immediately to the `.env` file

## Usage examples

### Basic request

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

### Streaming (real-time response)

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

### List available models

```bash
curl http://localhost:3456/v1/models -H "x-api-key: your-key"
```

## Configuration

All settings live in the `.env` file (or you can change them from the dashboard):

| Variable | Default | What it does |
|---|---|---|
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

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/messages` | Anthropic Messages API (sync + streaming) |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Health check + queue stats |
| `GET` | `/dashboard` | Web dashboard for monitoring and configuration |

## Limitations

- **Rate limits**: Consumer accounts have usage limits. The proxy adds its own configurable rate limiting to stay within them
- **No persistent sessions**: Each request spawns a new CLI process. Conversation history must be passed each time in the `messages` field
- **Streaming latency**: Streaming works but may have a small initial delay from the CLI
- **Model availability**: Depends on your Claude Code subscription tier
- **No image input via CLI**: Image content blocks are converted to text descriptions

## Docker

```bash
docker build -t claude-proxy .

docker run -p 3456:3456 \
  -v ~/.claude:/home/node/.claude:ro \
  -e PROXY_API_KEY=your-key \
  claude-proxy
```

> Claude Code CLI must be installed inside the Docker image or mounted as a volume.

## Project structure

```
src/
  index.ts              # Entry point
  server.ts             # Fastify server + routes + dashboard
  config/index.ts       # Environment configuration
  routes/
    messages.ts         # POST /v1/messages
    models.ts           # GET /v1/models
    health.ts           # GET /health
  providers/
    base.ts             # Provider interface
    cli-wrapper.ts      # Claude Code CLI wrapper
  queue/
    rate-limiter.ts     # Token bucket + circuit breaker
    request-queue.ts    # FIFO queue with concurrency control
  mappers/
    request-mapper.ts   # Request types + prompt builder
    response-mapper.ts  # CLI output → API response mapper
  streaming/
    sse-handler.ts      # Server-Sent Events handler
  utils/
    logger.ts           # Pino logger
    errors.ts           # Custom error types
```

## Disclaimer

This project is meant for **personal use and development only**. It is not designed for production. It relies on Claude Code's consumer account authentication, which has strict rate limits and usage policies. Use responsibly and in accordance with [Anthropic's Terms of Service](https://www.anthropic.com/terms).

## License

MIT
