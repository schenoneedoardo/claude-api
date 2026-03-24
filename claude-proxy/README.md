# claude-proxy

Local API proxy that exposes **Anthropic Messages API**-compatible endpoints using Claude Code CLI authentication instead of a paid API key.

> **Disclaimer**: This project is intended for **personal use and development only**. It is NOT designed for production use. It relies on Claude Code's consumer account authentication, which has strict rate limits and usage policies. Use responsibly and in accordance with Anthropic's Terms of Service.

## How it works

```
Client HTTP  -->  Fastify Server  -->  claude -p (CLI)  -->  Parse output  -->  HTTP Response
```

The proxy spawns `claude -p` (print mode) with `--output-format json` for each incoming request, mapping the Anthropic Messages API format to/from the CLI interface.

## Requirements

- **Node.js** 20+
- **pnpm** (or npm)
- **Claude Code** installed and authenticated (`claude` command available in PATH)

## Quick Start

```bash
# 1. Clone and install
cd claude-proxy
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env — set PROXY_API_KEY for security

# 3. Run (development)
pnpm dev

# 4. Test
curl http://localhost:3456/health
```

## Usage Examples

### Synchronous request

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key-here" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

### Streaming request (SSE)

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key-here" \
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

### List models

```bash
curl http://localhost:3456/v1/models \
  -H "x-api-key: your-secret-key-here"
```

### Dashboard

Open `http://localhost:3456/dashboard` in your browser for a live monitoring dashboard showing queue status, request counts, and circuit breaker state.

## Configuration

All configuration is done via environment variables (`.env` file):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3456` | Server port |
| `HOST` | `127.0.0.1` | Server host |
| `PROXY_API_KEY` | *(empty)* | API key for proxy auth (empty = no auth) |
| `PROVIDER` | `cli` | Provider type: `cli`, `token`, `browser` |
| `CLAUDE_CLI_PATH` | `claude` | Path to Claude Code CLI |
| `MAX_REQUESTS_PER_MINUTE` | `10` | Rate limit (token bucket) |
| `MAX_CONCURRENT_REQUESTS` | `2` | Max parallel CLI processes |
| `QUEUE_MAX_SIZE` | `50` | Max queued requests before 503 |
| `REQUEST_TIMEOUT_MS` | `120000` | Request timeout (ms) |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Consecutive failures to open circuit |
| `CIRCUIT_BREAKER_COOLDOWN_MS` | `60000` | Cooldown before half-open probe |
| `LOG_LEVEL` | `info` | Pino log level |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/messages` | Anthropic Messages API (sync + streaming) |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Health check + queue stats |
| `GET` | `/dashboard` | HTML monitoring dashboard |

## Limitations

- **Rate limits**: Consumer accounts have strict rate limits. The proxy enforces its own rate limiting (configurable) to avoid hitting Anthropic's limits.
- **No multi-turn in CLI**: Each request spawns a fresh `claude -p` process. Conversation history is passed as context in the prompt, not as a persistent session.
- **Streaming latency**: Streaming works via `--output-format stream-json`, but there may be initial buffering delay from the CLI.
- **Model availability**: Available models depend on your Claude Code subscription tier.
- **No image input via CLI**: Image content blocks are converted to text descriptions.

## Docker

```bash
# Build
docker build -t claude-proxy .

# Run (mount Claude credentials)
docker run -p 3456:3456 \
  -v ~/.claude:/home/node/.claude:ro \
  -e PROXY_API_KEY=your-secret-key \
  claude-proxy
```

Note: Claude Code CLI must be installed inside the Docker image or mounted as a volume for the CLI wrapper to work.

## Project Structure

```
src/
  index.ts              # Entry point
  server.ts             # Fastify config + routes + dashboard
  config/index.ts       # Environment configuration
  routes/
    messages.ts         # POST /v1/messages
    models.ts           # GET /v1/models
    health.ts           # GET /health
  providers/
    base.ts             # Provider interface
    cli-wrapper.ts      # Claude Code CLI wrapper (primary)
  auth/
    credential-reader.ts
    token-refresh.ts
    session-manager.ts
  queue/
    rate-limiter.ts     # Token bucket + circuit breaker
    request-queue.ts    # FIFO queue with concurrency control
  mappers/
    request-mapper.ts   # API request types + prompt builder
    response-mapper.ts  # CLI output → API response mapper
  streaming/
    sse-handler.ts      # Server-Sent Events handler
  utils/
    logger.ts           # Pino logger
    errors.ts           # Custom error types
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
