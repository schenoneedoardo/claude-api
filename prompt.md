# Prompt di Sviluppo: Claude Account API Proxy

## Istruzioni per Claude Code

Sviluppa un'applicazione open-source chiamata **claude-proxy** che espone API REST compatibili con il formato Anthropic Messages API, sfruttando l'autenticazione di Claude Code (account consumer Anthropic) anziché una API key a pagamento.

---

## Obiettivo

Creare un server locale che:
1. Utilizza le credenziali salvate da Claude Code (OAuth session token) per autenticarsi con Anthropic
2. Espone endpoint REST che replicano il formato dell'Anthropic Messages API (`/v1/messages`)
3. Supporta streaming (SSE) e risposte sincrone
4. Gestisce rate limiting e retry automatici
5. È pensato per uso personale/sviluppo, NON per produzione

---

## Stack Tecnologico

- **Runtime**: Node.js (TypeScript)
- **Framework**: Fastify (performance + TypeScript support nativo)
- **Package manager**: pnpm
- **Struttura**: monorepo-ready, ma inizia come singolo package

---

## Architettura

### Approccio 1: Wrapper su Claude Code CLI (Prioritario)

Usa Claude Code in modalità non-interattiva come backend:

```
Client HTTP → Fastify Server → spawn("claude", ["-p", prompt]) → Parse output → HTTP Response
```

- Usa `child_process.spawn` per invocare `claude -p` (print mode)
- Parsa stdout per estrarre la risposta
- Mappa input/output al formato Messages API

### Approccio 2: Token Extraction (Fallback)

Se il wrapper CLI ha troppi limiti:

1. Leggi il token OAuth dalle credenziali salvate da Claude Code
   - Check paths: `~/.claude/credentials.json`, `~/.config/claude/credentials.json`
   - Parsa il file e estrai il session token / access token
2. Replica le chiamate HTTP che Claude Code fa verso i server Anthropic
   - Intercetta e documenta gli endpoint reali (probabilmente `api.anthropic.com` o `claude.ai/api`)
   - Usa gli stessi headers di autenticazione
3. Esponi come proxy trasparente

### Approccio 3: Headless Browser Session (Ultima risorsa)

Se i token non sono direttamente riutilizzabili:

- Usa Puppeteer/Playwright per mantenere una sessione claude.ai
- Intercetta le richieste API del frontend web
- Proxy le richieste attraverso la sessione autenticata

---

## Struttura del Progetto

```
claude-proxy/
├── src/
│   ├── index.ts              # Entry point, avvia il server Fastify
│   ├── server.ts             # Configurazione Fastify + routes
│   ├── routes/
│   │   ├── messages.ts       # POST /v1/messages (compatibile Anthropic API)
│   │   ├── models.ts         # GET /v1/models (lista modelli disponibili)
│   │   └── health.ts         # GET /health
│   ├── providers/
│   │   ├── base.ts           # Interfaccia astratta Provider
│   │   ├── cli-wrapper.ts    # Approccio 1: wrapper Claude Code CLI
│   │   ├── token-proxy.ts    # Approccio 2: token extraction + proxy
│   │   └── browser-session.ts # Approccio 3: headless browser
│   ├── auth/
│   │   ├── credential-reader.ts  # Legge credenziali Claude Code
│   │   ├── token-refresh.ts      # Gestisce refresh dei token OAuth
│   │   └── session-manager.ts    # Mantiene sessione attiva
│   ├── queue/
│   │   ├── request-queue.ts  # Coda richieste con rate limiting
│   │   └── rate-limiter.ts   # Rate limiter adattivo
│   ├── mappers/
│   │   ├── request-mapper.ts # Mappa API request → formato interno
│   │   └── response-mapper.ts # Mappa risposta interna → API response
│   ├── streaming/
│   │   └── sse-handler.ts    # Server-Sent Events per streaming
│   ├── config/
│   │   └── index.ts          # Configurazione (env vars, defaults)
│   └── utils/
│       ├── logger.ts         # Logger strutturato (pino)
│       └── errors.ts         # Error handling centralizzato
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
└── README.md
```

---

## Specifiche API

### POST /v1/messages

Deve accettare lo STESSO formato della Anthropic Messages API:

```typescript
interface MessagesRequest {
  model: string;                    // "claude-sonnet-4-20250514", etc.
  max_tokens: number;
  messages: Array<{
    role: "user" | "assistant";
    content: string | ContentBlock[];
  }>;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop_sequences?: string[];
  metadata?: Record<string, string>;
}
```

**Response format** (identico all'API ufficiale):

```typescript
interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

### Streaming (SSE)

Quando `stream: true`, restituisci Server-Sent Events con gli stessi event types dell'API Anthropic:
- `message_start`
- `content_block_start`
- `content_block_delta`
- `content_block_stop`
- `message_delta`
- `message_stop`

### Autenticazione del Proxy

Il proxy stesso deve avere un meccanismo di auth per evitare accesso non autorizzato:
- API key locale configurabile via `.env` (es. `PROXY_API_KEY=mia-chiave-segreta`)
- Il client passa questa chiave nell'header `x-api-key` o `Authorization: Bearer`
- Se la chiave non matcha, ritorna 401

---

## Configurazione (.env)

```env
# Server
PORT=3456
HOST=127.0.0.1

# Auth del proxy (per proteggere l'accesso)
PROXY_API_KEY=your-secret-key-here

# Provider (cli | token | browser)
PROVIDER=cli

# Claude Code CLI path (se non in PATH)
CLAUDE_CLI_PATH=claude

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=10
MAX_CONCURRENT_REQUESTS=2
QUEUE_MAX_SIZE=50

# Logging
LOG_LEVEL=info
```

---

## Rate Limiting & Queue

Questo è CRITICO perché l'account consumer ha limiti stretti:

1. **Token Bucket** rate limiter:
   - Default: 10 req/min, 2 concorrenti
   - Configurabile via env
   - Backoff esponenziale su 429/rate limit errors

2. **Request Queue**:
   - FIFO con priorità opzionale
   - Timeout configurabile per richiesta (default 120s)
   - Se la coda è piena, ritorna 503 immediatamente

3. **Circuit Breaker**:
   - Se N errori consecutivi (es. 5), apri il circuito
   - Retry dopo cooldown period (es. 60s)
   - Evita di martellare il servizio se l'account è rate-limited

---

## Implementazione Provider CLI Wrapper

Questo è il provider principale. Dettagli implementativi:

```typescript
// Pseudocodice per la logica core
async function sendMessage(request: MessagesRequest): Promise<MessagesResponse> {
  // 1. Costruisci il prompt dal formato Messages API
  const prompt = buildPromptFromMessages(request.messages, request.system);
  
  // 2. Invoca Claude Code CLI
  const args = ["-p", "--output-format", "json"];
  if (request.model) args.push("--model", request.model);
  
  const result = await spawnClaude(args, prompt);
  
  // 3. Parsa e mappa la risposta
  return mapToMessagesResponse(result, request.model);
}
```

**Note importanti per il CLI wrapper**:
- Esplora TUTTI i flag disponibili: `claude --help`
- Verifica se esiste `--output-format json` o simile
- Verifica se supporta `--model` per selezionare il modello
- Testa se supporta input da stdin: `echo "prompt" | claude -p`
- Per streaming: verifica se `-p` emette output incrementalmente (streamable via stdout)
- Gestisci correttamente i segnali (SIGTERM, SIGINT) per killare i processi figli

---

## Feature Aggiuntive

### 1. Dashboard di monitoraggio (opzionale)
- Endpoint GET `/dashboard` con UI HTML minimale
- Mostra: richieste totali, errori, coda attuale, stato circuit breaker
- Usa solo HTML/CSS inline, zero dipendenze frontend

### 2. Request/Response Logging
- Log strutturato di ogni richiesta (senza contenuto sensibile)
- Salva metriche: latenza, tokens stimati, modello usato
- File log rotante o SQLite per persistenza

### 3. Compatibilità OpenAI (stretch goal)
- Endpoint aggiuntivo `POST /v1/chat/completions` 
- Accetta formato OpenAI e lo converte internamente al formato Anthropic
- Permette di usare il proxy come drop-in replacement per OpenAI

### 4. Docker Support
- Dockerfile multi-stage (build + runtime)
- Monta il volume delle credenziali Claude Code: `-v ~/.claude:/home/node/.claude:ro`

---

## Istruzioni di Sviluppo

1. **Inizia dall'Approccio 1** (CLI Wrapper) — è il più semplice e meno fragile
2. **Testa subito** la CLI di Claude Code:
   - `claude --help` per documentare tutti i flag
   - `echo "ciao" | claude -p` per verificare il pipe mode
   - Verifica il formato dell'output
3. **Implementa prima** il flow sincrono base, poi aggiungi streaming
4. **Scrivi test** per i mapper request/response
5. **Documenta** nel README come installare, configurare e usare

## Qualità del Codice

- TypeScript strict mode
- ESLint + Prettier configurati
- Error handling robusto con tipi custom
- Graceful shutdown (gestione SIGTERM)
- Zero `any` types — usa generics e union types
- Commenti JSDoc sulle funzioni pubbliche

---

## README.md

Il README deve includere:
- Descrizione chiara del progetto e disclaimer sull'uso (solo personale/dev)
- Requisiti: Node.js 20+, Claude Code installato e autenticato
- Quick start (3-5 comandi per essere operativo)
- Configurazione completa (.env reference)
- Esempi di utilizzo con curl
- Limitazioni note (rate limits, modelli disponibili, etc.)
- Come contribuire
- License: MIT