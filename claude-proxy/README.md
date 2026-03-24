# Claude Proxy

**Usa Claude come API gratuita, senza pagare un centesimo.**

Se hai un abbonamento a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (il tool CLI di Anthropic), questo proxy ti permette di usare Claude come se fosse un'API standard — integrabile con qualsiasi app, script o tool che supporta le API di Anthropic.

In pratica: invece di pagare per le API a consumo di Anthropic (che costano in base ai token), questo proxy sfrutta l'autenticazione del tuo abbonamento Claude Code per rispondere alle richieste. Tu mandi una chiamata HTTP, lui la gira al CLI di Claude e ti restituisce la risposta nello stesso formato delle API ufficiali.

---

## A cosa serve, in pratica?

- **Collegare Claude a qualsiasi applicazione** (Cursor, Continue, LibreChat, script Python, bot Telegram...) senza una API key a pagamento
- **Testare e sviluppare** integrazioni AI senza spendere in token
- **Monitorare tutto** da una dashboard web con metriche in tempo reale
- **Modificare la configurazione al volo** direttamente dal browser

## Come funziona (in parole semplici)

```
La tua app  →  Claude Proxy (localhost)  →  Claude Code CLI  →  Risposta AI
```

1. La tua app manda una richiesta HTTP (identica a come farebbe con le API Anthropic)
2. Il proxy la riceve, la trasforma in un comando per il CLI di Claude
3. Claude risponde tramite il CLI
4. Il proxy converte la risposta nel formato standard Anthropic e la rimanda alla tua app

Per la tua app non cambia nulla: e' come parlare direttamente con le API di Anthropic.

---

## Requisiti

- **Node.js** 20+
- **pnpm** (o npm)
- **Claude Code** installato e autenticato (il comando `claude` deve funzionare dal terminale)

## Installazione

```bash
# 1. Clona e installa le dipendenze
cd claude-proxy
pnpm install

# 2. Crea il file di configurazione
cp .env.example .env

# 3. Avvia il server
pnpm dev
```

Il proxy sara' attivo su `http://localhost:3456`.

## Dashboard

Apri `http://localhost:3456/dashboard` nel browser.

La dashboard ha due sezioni:

- **Monitor** — metriche in tempo reale: coda richieste, richieste attive, errori, stato circuit breaker, uptime
- **Configurazione** — modifica tutti i parametri del proxy direttamente dal browser: rate limiting, concorrenza, timeout, circuit breaker, provider, log level. Le modifiche vengono salvate immediatamente nel file `.env`

## Esempi di utilizzo

### Richiesta base

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: tua-chiave" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Ciao Claude!"}
    ]
  }'
```

### Streaming (risposta in tempo reale)

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: tua-chiave" \
  -N \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Scrivi un haiku sul codice"}
    ]
  }'
```

### Modelli disponibili

```bash
curl http://localhost:3456/v1/models -H "x-api-key: tua-chiave"
```

## Configurazione

Tutti i parametri si trovano nel file `.env` (oppure puoi modificarli dalla dashboard):

| Variabile | Default | Cosa fa |
|---|---|---|
| `PORT` | `3456` | Porta del server |
| `HOST` | `127.0.0.1` | Indirizzo di ascolto |
| `PROXY_API_KEY` | *(vuoto)* | Chiave per proteggere il proxy (vuoto = accesso libero) |
| `PROVIDER` | `cli` | Tipo di provider (`cli` per ora) |
| `CLAUDE_CLI_PATH` | `claude` | Percorso dell'eseguibile Claude Code |
| `MAX_REQUESTS_PER_MINUTE` | `10` | Limite richieste al minuto |
| `MAX_CONCURRENT_REQUESTS` | `2` | Richieste parallele massime |
| `QUEUE_MAX_SIZE` | `50` | Richieste in coda prima di rifiutare |
| `REQUEST_TIMEOUT_MS` | `120000` | Timeout per richiesta (in millisecondi) |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Errori consecutivi prima di bloccare |
| `CIRCUIT_BREAKER_COOLDOWN_MS` | `60000` | Tempo di attesa dopo il blocco |
| `LOG_LEVEL` | `info` | Livello di log |

## Endpoint API

| Metodo | Path | Descrizione |
|---|---|---|
| `POST` | `/v1/messages` | API Messages di Anthropic (sync + streaming) |
| `GET` | `/v1/models` | Lista modelli disponibili |
| `GET` | `/health` | Health check + statistiche coda |
| `GET` | `/dashboard` | Dashboard web di monitoraggio e configurazione |

## Limitazioni

- **Rate limit**: Gli account consumer hanno limiti d'uso. Il proxy aggiunge un suo rate limiting configurabile per evitare di superarli
- **Nessuna sessione persistente**: Ogni richiesta avvia un nuovo processo CLI. La storia della conversazione va passata ogni volta nel campo `messages`
- **Latenza streaming**: Lo streaming funziona ma puo' avere un piccolo ritardo iniziale dovuto al CLI
- **Modelli disponibili**: Dipendono dal tuo livello di abbonamento a Claude Code
- **Niente immagini via CLI**: I blocchi immagine vengono convertiti in descrizioni testuali

## Docker

```bash
docker build -t claude-proxy .

docker run -p 3456:3456 \
  -v ~/.claude:/home/node/.claude:ro \
  -e PROXY_API_KEY=tua-chiave \
  claude-proxy
```

> Il CLI di Claude Code deve essere installato nell'immagine Docker o montato come volume.

## Struttura del progetto

```
src/
  index.ts              # Entry point
  server.ts             # Server Fastify + routes + dashboard
  config/index.ts       # Configurazione da .env
  routes/
    messages.ts         # POST /v1/messages
    models.ts           # GET /v1/models
    health.ts           # GET /health
  providers/
    base.ts             # Interfaccia provider
    cli-wrapper.ts      # Wrapper per Claude Code CLI
  queue/
    rate-limiter.ts     # Token bucket + circuit breaker
    request-queue.ts    # Coda FIFO con controllo concorrenza
  mappers/
    request-mapper.ts   # Tipi richiesta + costruttore prompt
    response-mapper.ts  # Output CLI → risposta API
  streaming/
    sse-handler.ts      # Handler Server-Sent Events
  utils/
    logger.ts           # Logger Pino
    errors.ts           # Tipi di errore custom
```

## Disclaimer

Questo progetto e' pensato per **uso personale e sviluppo**. Non e' progettato per la produzione. Si basa sull'autenticazione dell'account consumer di Claude Code, che ha limiti d'uso e policy specifiche. Usalo responsabilmente e in conformita' con i [Termini di Servizio di Anthropic](https://www.anthropic.com/terms).

## Licenza

MIT
