import Fastify from "fastify";
import { config, updateConfig, UPDATABLE_KEYS } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { ProxyError, AuthError } from "./utils/errors.js";
import { healthRoutes } from "./routes/health.js";
import { modelsRoutes } from "./routes/models.js";
import { messagesRoutes } from "./routes/messages.js";
import { CliWrapperProvider } from "./providers/cli-wrapper.js";
import type { Provider } from "./providers/base.js";
import { requestQueue } from "./queue/request-queue.js";

function createProvider(): Provider {
  switch (config.provider) {
    case "cli":
      return new CliWrapperProvider();
    case "token":
      logger.warn("Token proxy provider not yet implemented, falling back to CLI");
      return new CliWrapperProvider();
    case "browser":
      logger.warn("Browser session provider not yet implemented, falling back to CLI");
      return new CliWrapperProvider();
    default:
      return new CliWrapperProvider();
  }
}

export async function buildServer() {
  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  const provider = createProvider();
  logger.info({ provider: provider.name }, "Using provider");

  // --- Auth middleware (skip /health and /dashboard*) ---
  app.addHook("onRequest", async (req, _reply) => {
    const path = req.url;
    if (path === "/health" || path.startsWith("/dashboard")) {
      return;
    }

    if (!config.proxyApiKey) {
      return;
    }

    const apiKey =
      req.headers["x-api-key"] ??
      req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (apiKey !== config.proxyApiKey) {
      throw new AuthError();
    }
  });

  // --- Error handler ---
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ProxyError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    logger.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      type: "error",
      error: {
        type: "internal_error",
        message: "An internal error occurred",
      },
    });
  });

  // --- Routes ---
  await app.register(healthRoutes);
  await app.register(modelsRoutes);
  await messagesRoutes(app, provider);

  // --- Dashboard API: get config ---
  app.get("/dashboard/api/config", async (_req, reply) => {
    return reply.send({
      proxyApiKey: config.proxyApiKey,
      provider: config.provider,
      claudeCliPath: config.claudeCliPath,
      maxRequestsPerMinute: config.maxRequestsPerMinute,
      maxConcurrentRequests: config.maxConcurrentRequests,
      queueMaxSize: config.queueMaxSize,
      requestTimeoutMs: config.requestTimeoutMs,
      circuitBreakerThreshold: config.circuitBreakerThreshold,
      circuitBreakerCooldownMs: config.circuitBreakerCooldownMs,
      logLevel: config.logLevel,
      host: config.host,
      port: config.port,
    });
  });

  // --- Dashboard API: get stats ---
  app.get("/dashboard/api/stats", async (_req, reply) => {
    const stats = requestQueue.stats;
    return reply.send({
      ...stats,
      uptime: Math.floor(process.uptime()),
    });
  });

  // --- Dashboard API: update config ---
  app.post("/dashboard/api/config", async (req, reply) => {
    const body = req.body as Record<string, unknown> | null;
    if (!body) {
      return reply.status(400).send({ error: "Missing body" });
    }

    const updates: Record<string, unknown> = {};
    const intKeys = [
      "maxRequestsPerMinute",
      "maxConcurrentRequests",
      "queueMaxSize",
      "requestTimeoutMs",
      "circuitBreakerThreshold",
      "circuitBreakerCooldownMs",
    ];

    for (const key of UPDATABLE_KEYS) {
      if (key in body) {
        if (intKeys.includes(key)) {
          const n = parseInt(String(body[key]), 10);
          if (!Number.isNaN(n) && n >= 0) {
            updates[key] = n;
          }
        } else {
          updates[key] = String(body[key]);
        }
      }
    }

    try {
      updateConfig(updates as Parameters<typeof updateConfig>[0]);
      logger.info({ updates }, "Config updated from dashboard");
      return reply.send({ ok: true, config: updates });
    } catch (err) {
      logger.error({ err }, "Failed to update config");
      return reply.status(500).send({ error: "Failed to save config" });
    }
  });

  // --- Dashboard: main page (no auth required) ---
  app.get("/dashboard", async (_req, reply) => {
    return reply.type("text/html").send(buildDashboardHtml());
  });

  return app;
}

function buildDashboardHtml(): string {
  return `<!DOCTYPE html>
<html class="dark" lang="it"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>CLAUDE_PROXY | Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary-dim": "#6063ee",
        "on-primary": "#FFFFFF",
        "primary": "#b1b4ff",
        "surface-container": "#1c1c24",
        "background": "#08080c",
        "outline": "#8e8d94",
        "surface-container-low": "#15151c",
        "error": "#ff3b5c",
        "surface": "#08080c",
        "surface-variant": "#2a2a33",
        "surface-container-high": "#23232d",
        "surface-container-highest": "#31313d",
        "surface-container-lowest": "#000000",
        "on-surface": "#ffffff",
        "on-surface-variant": "#d1d1d6",
        "outline-variant": "#555561",
      },
      fontFamily: {
        "headline": ["Space Grotesk"],
        "body": ["Inter"],
        "label": ["Inter"],
        "mono": ["JetBrains Mono"]
      },
    },
  },
}
</script>
<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.pulse-square {
  animation: pulse-square 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse-square {
  0%, 100% { opacity: 1; filter: brightness(1.5); }
  50% { opacity: 0.7; filter: brightness(1); }
}
.status-ok { border-left: 6px solid #22c55e; }
.status-warn { border-left: 6px solid #f97316; }
.status-err { border-left: 6px solid #ef4444; }
.glow-hover:hover {
  background-color: #1f1f2b;
  box-shadow: 0 0 20px rgba(163, 166, 255, 0.1);
}
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #48474d; border-radius: 10px; }
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
.cfg-input {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(85,85,97,0.4);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}
.cfg-input:focus {
  border-color: #b1b4ff;
  box-shadow: 0 0 0 2px rgba(177,180,255,0.15);
}
.cfg-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toast {
  position: fixed; bottom: 2rem; right: 2rem; z-index: 100;
  padding: 1rem 1.5rem; border-radius: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700;
  transform: translateY(120%); opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
.toast.error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; }
.tab-btn {
  padding: 0.5rem 1.25rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #d1d1d6;
  background: transparent;
}
.tab-btn:hover { background: rgba(177,180,255,0.08); color: #fff; }
.tab-btn.active {
  background: rgba(177,180,255,0.12);
  border-color: rgba(177,180,255,0.25);
  color: #b1b4ff;
}
</style>
</head>
<body class="bg-background text-on-surface font-body selection:bg-primary selection:text-black">

<!-- Toast notification -->
<div id="toast" class="toast"></div>

<!-- Header -->
<header class="bg-surface/95 backdrop-blur-md flex justify-between items-center w-full px-8 py-3 h-16 border-b border-outline-variant/30 fixed top-0 z-50">
  <div class="flex items-center gap-6">
    <div class="font-mono font-black tracking-widest text-on-surface text-xl">CLAUDE_PROXY</div>
    <div id="statusBadge" class="flex items-center gap-2 px-4 py-1.5 bg-surface-container-highest rounded-full border border-outline-variant/20">
      <span class="text-green-500 font-mono text-xs pulse-square">&#9632;</span>
      <span class="font-mono text-xs font-bold tracking-widest text-on-surface">SYSTEM_ONLINE</span>
    </div>
  </div>
  <div class="hidden md:flex items-center gap-4">
    <button onclick="switchTab('monitor')" id="tabMonitor" class="tab-btn active">
      <span class="material-symbols-outlined text-sm align-middle mr-1">monitoring</span>MONITOR
    </button>
    <button onclick="switchTab('config')" id="tabConfig" class="tab-btn">
      <span class="material-symbols-outlined text-sm align-middle mr-1">tune</span>CONFIGURAZIONE
    </button>
  </div>
</header>

<main class="pt-24 px-6 md:px-12 lg:px-20 pb-16 max-w-7xl mx-auto">

  <!-- ========== MONITOR TAB ========== -->
  <div id="panelMonitor">
    <!-- Title row -->
    <div class="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant/10 pb-8">
      <div>
        <h1 class="font-headline font-black text-4xl tracking-tight text-white mb-2">MONITOR</h1>
        <p class="font-mono text-sm text-on-surface-variant tracking-[0.1em] uppercase flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-primary"></span>
          Stato in tempo reale &middot; aggiornamento ogni 3s
        </p>
      </div>
      <div class="text-right">
        <div class="font-mono text-xs text-on-surface-variant tracking-widest uppercase mb-2 font-bold">CIRCUIT_BREAKER</div>
        <div id="circuitBadge" class="font-mono text-2xl text-green-500 font-black tracking-tighter bg-green-500/10 px-4 py-1 rounded-sm border border-green-500/20">[CLOSED]</div>
      </div>
    </div>

    <!-- Rate limit bar -->
    <section class="mb-10 bg-surface-container-high p-6 border border-outline-variant/20 rounded-lg shadow-xl">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-xl">speed</span>
          <span class="font-mono text-sm tracking-[0.15em] font-black text-white">RATE_LIMIT_USAGE</span>
        </div>
        <span id="ratePct" class="font-mono text-sm text-primary font-black bg-primary/10 px-3 py-1 rounded">0%</span>
      </div>
      <div class="w-full h-4 bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant/30 p-0.5">
        <div id="rateBar" class="h-full bg-primary rounded-full shadow-[0_0_20px_rgba(163,166,255,0.6)] transition-all duration-700 relative" style="width:0%">
          <div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
        </div>
      </div>
    </section>

    <!-- Metric cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
      <div id="cardQueue" class="bg-surface-container-low p-5 status-ok glow-hover transition-all rounded-r-lg border-y border-r border-outline-variant/20">
        <div class="flex justify-between items-start mb-4">
          <span class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase">Queue Size</span>
          <span class="material-symbols-outlined text-green-500 text-xl">reorder</span>
        </div>
        <div id="valQueue" class="font-mono text-4xl font-black tracking-tighter text-white leading-none">-</div>
      </div>
      <div class="bg-surface-container-low p-5 status-ok glow-hover transition-all rounded-r-lg border-y border-r border-outline-variant/20">
        <div class="flex justify-between items-start mb-4">
          <span class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase">Active Requests</span>
          <span class="material-symbols-outlined text-green-500 text-xl">sync_alt</span>
        </div>
        <div id="valActive" class="font-mono text-4xl font-black tracking-tighter text-white leading-none">-</div>
      </div>
      <div class="bg-surface-container-low p-5 status-ok glow-hover transition-all rounded-r-lg border-y border-r border-outline-variant/20">
        <div class="flex justify-between items-start mb-4">
          <span class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase">Completate</span>
          <span class="material-symbols-outlined text-orange-500 text-xl">task_alt</span>
        </div>
        <div id="valCompleted" class="font-mono text-4xl font-black tracking-tighter text-white leading-none">-</div>
      </div>
      <div id="cardErrors" class="bg-surface-container-low p-5 status-ok glow-hover transition-all rounded-r-lg border-y border-r border-outline-variant/20">
        <div class="flex justify-between items-start mb-4">
          <span class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase">Errori</span>
          <span class="material-symbols-outlined text-red-500 text-xl">error_outline</span>
        </div>
        <div id="valErrors" class="font-mono text-4xl font-black tracking-tighter text-white leading-none">-</div>
      </div>
    </div>

    <!-- Info row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
        <div class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase mb-3">Uptime</div>
        <div id="valUptime" class="font-mono text-2xl font-black text-white">-</div>
      </div>
      <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
        <div class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase mb-3">Richieste Totali</div>
        <div id="valTotal" class="font-mono text-2xl font-black text-white">-</div>
      </div>
      <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
        <div class="font-mono text-xs tracking-widest text-on-surface-variant font-black uppercase mb-3">Token Disponibili</div>
        <div id="valTokens" class="font-mono text-2xl font-black text-white">-</div>
      </div>
    </div>
  </div>

  <!-- ========== CONFIG TAB ========== -->
  <div id="panelConfig" class="hidden">
    <div class="mb-10 border-b border-outline-variant/10 pb-8">
      <h1 class="font-headline font-black text-4xl tracking-tight text-white mb-2">CONFIGURAZIONE</h1>
      <p class="font-mono text-sm text-on-surface-variant tracking-[0.1em] uppercase flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-primary"></span>
        Modifica i parametri del proxy in tempo reale
      </p>
    </div>

    <form id="configForm" onsubmit="return saveConfig(event)">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

        <!-- Rate Limiting -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-xl">speed</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-white uppercase">Rate Limiting</h2>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">MAX RICHIESTE / MINUTO</label>
              <input type="number" name="maxRequestsPerMinute" class="cfg-input" min="1" />
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">MAX RICHIESTE CONCORRENTI</label>
              <input type="number" name="maxConcurrentRequests" class="cfg-input" min="1" />
            </div>
          </div>
        </div>

        <!-- Queue -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-xl">reorder</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-white uppercase">Coda Richieste</h2>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">DIMENSIONE MAX CODA</label>
              <input type="number" name="queueMaxSize" class="cfg-input" min="1" />
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">TIMEOUT RICHIESTA (ms)</label>
              <input type="number" name="requestTimeoutMs" class="cfg-input" min="1000" step="1000" />
            </div>
          </div>
        </div>

        <!-- Circuit Breaker -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-xl">electric_bolt</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-white uppercase">Circuit Breaker</h2>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">SOGLIA ERRORI CONSECUTIVI</label>
              <input type="number" name="circuitBreakerThreshold" class="cfg-input" min="1" />
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">COOLDOWN (ms)</label>
              <input type="number" name="circuitBreakerCooldownMs" class="cfg-input" min="1000" step="1000" />
            </div>
          </div>
        </div>

        <!-- Provider & Logging -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-xl">settings</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-white uppercase">Provider & Log</h2>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">PROVIDER</label>
              <select name="provider" class="cfg-input">
                <option value="cli">cli</option>
                <option value="token">token</option>
                <option value="browser">browser</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">CLAUDE CLI PATH</label>
              <input type="text" name="claudeCliPath" class="cfg-input" />
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">LOG LEVEL</label>
              <select name="logLevel" class="cfg-input">
                <option value="trace">trace</option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
                <option value="fatal">fatal</option>
              </select>
            </div>
          </div>
        </div>

        <!-- API Key -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg lg:col-span-2">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-xl">key</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-white uppercase">Autenticazione API</h2>
          </div>
          <div>
            <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">PROXY API KEY <span class="text-on-surface-variant/60">(vuoto = nessuna autenticazione)</span></label>
            <input type="text" name="proxyApiKey" class="cfg-input" placeholder="Lascia vuoto per disabilitare" />
          </div>
        </div>

        <!-- Server info (read-only) -->
        <div class="bg-surface-container-low border border-outline-variant/20 p-6 rounded-lg lg:col-span-2 opacity-70">
          <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-on-surface-variant text-xl">dns</span>
            <h2 class="font-mono text-sm font-black tracking-widest text-on-surface-variant uppercase">Server (solo lettura &mdash; richiede riavvio)</h2>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">HOST</label>
              <input type="text" id="cfgHost" class="cfg-input" disabled />
            </div>
            <div>
              <label class="block font-mono text-xs text-on-surface-variant font-bold tracking-wider mb-1.5">PORT</label>
              <input type="number" id="cfgPort" class="cfg-input" disabled />
            </div>
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div class="flex justify-end">
        <button type="submit" id="saveBtn" class="flex items-center gap-2 bg-primary text-black font-mono text-sm font-black tracking-widest px-8 py-3 rounded-lg hover:brightness-125 transition-all active:scale-95 shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-lg">save</span>
          SALVA CONFIGURAZIONE
        </button>
      </div>
    </form>
  </div>

</main>

<!-- Footer -->
<footer class="border-t border-outline-variant/30 py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center text-on-surface-variant font-mono text-[11px] font-black tracking-[0.15em] uppercase">
  <div class="flex flex-wrap gap-8 mb-4 md:mb-0">
    <div class="flex items-center gap-2"><span class="text-white">UPTIME:</span> <span id="footerUptime" class="text-primary">-</span></div>
    <div class="flex items-center gap-2"><span class="text-white">BUILD:</span> <span class="text-primary">v1.0.4</span></div>
  </div>
  <div class="flex items-center gap-3 bg-green-500/10 px-4 py-2 border border-green-500/20 rounded-sm">
    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
    <span class="text-green-500">SYSTEM_OPERATIONAL</span>
  </div>
</footer>

<!-- Mobile nav -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant/30 h-16 flex items-center justify-around z-50">
  <button onclick="switchTab('monitor')" class="flex flex-col items-center gap-1 text-primary">
    <span class="material-symbols-outlined text-xl">monitoring</span>
    <span class="text-[9px] font-mono font-black tracking-widest">MONITOR</span>
  </button>
  <button onclick="switchTab('config')" class="flex flex-col items-center gap-1 text-on-surface-variant">
    <span class="material-symbols-outlined text-xl">tune</span>
    <span class="text-[9px] font-mono font-black tracking-widest">CONFIG</span>
  </button>
</nav>

<script>
// --- Tab switching ---
function switchTab(tab) {
  const monitor = document.getElementById('panelMonitor');
  const config = document.getElementById('panelConfig');
  const tabM = document.getElementById('tabMonitor');
  const tabC = document.getElementById('tabConfig');

  if (tab === 'monitor') {
    monitor.classList.remove('hidden');
    config.classList.add('hidden');
    tabM.classList.add('active');
    tabC.classList.remove('active');
  } else {
    monitor.classList.add('hidden');
    config.classList.remove('hidden');
    tabM.classList.remove('active');
    tabC.classList.add('active');
    loadConfig();
  }
}

// --- Toast ---
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => { t.classList.remove('show'); }, 3000);
}

// --- Format uptime ---
function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  parts.push(sec + 's');
  return parts.join(' ');
}

// --- Poll stats ---
async function refreshStats() {
  try {
    const res = await fetch('/dashboard/api/stats');
    const d = await res.json();

    document.getElementById('valQueue').textContent = d.queueSize;
    document.getElementById('valActive').textContent = d.activeRequests;
    document.getElementById('valCompleted').textContent = d.totalCompleted;
    document.getElementById('valErrors').textContent = d.totalErrors;
    document.getElementById('valTotal').textContent = d.totalRequests;
    document.getElementById('valTokens').textContent = d.availableTokens;

    const up = fmtUptime(d.uptime);
    document.getElementById('valUptime').textContent = up;
    document.getElementById('footerUptime').textContent = up;

    // Circuit breaker badge
    const cb = document.getElementById('circuitBadge');
    if (d.circuitState === 'closed') {
      cb.textContent = '[CLOSED]';
      cb.className = 'font-mono text-2xl text-green-500 font-black tracking-tighter bg-green-500/10 px-4 py-1 rounded-sm border border-green-500/20';
    } else if (d.circuitState === 'open') {
      cb.textContent = '[OPEN]';
      cb.className = 'font-mono text-2xl text-red-500 font-black tracking-tighter bg-red-500/10 px-4 py-1 rounded-sm border border-red-500/20';
    } else {
      cb.textContent = '[HALF-OPEN]';
      cb.className = 'font-mono text-2xl text-orange-500 font-black tracking-tighter bg-orange-500/10 px-4 py-1 rounded-sm border border-orange-500/20';
    }

    // Queue card color
    const cq = document.getElementById('cardQueue');
    cq.classList.remove('status-ok', 'status-warn', 'status-err');
    cq.classList.add(d.queueSize > 30 ? 'status-warn' : 'status-ok');

    // Errors card color
    const ce = document.getElementById('cardErrors');
    ce.classList.remove('status-ok', 'status-warn', 'status-err');
    ce.classList.add(d.totalErrors > 0 ? 'status-err' : 'status-ok');

    // Rate bar
    const maxTokens = d.availableTokens + d.activeRequests + d.queueSize;
    const used = maxTokens > 0 ? Math.round(((maxTokens - d.availableTokens) / maxTokens) * 100) : 0;
    document.getElementById('rateBar').style.width = used + '%';
    document.getElementById('ratePct').textContent = used + '% UTILIZZATO';

  } catch (e) {
    console.error('Stats fetch failed', e);
  }
}

// --- Load config into form ---
async function loadConfig() {
  try {
    const res = await fetch('/dashboard/api/config');
    const cfg = await res.json();
    const form = document.getElementById('configForm');

    for (const [key, val] of Object.entries(cfg)) {
      const el = form.elements[key];
      if (el) el.value = val;
    }
    document.getElementById('cfgHost').value = cfg.host || '';
    document.getElementById('cfgPort').value = cfg.port || '';
  } catch (e) {
    showToast('Errore caricamento configurazione', 'error');
  }
}

// --- Save config ---
async function saveConfig(e) {
  e.preventDefault();
  const form = document.getElementById('configForm');
  const fd = new FormData(form);
  const body = {};

  for (const [k, v] of fd.entries()) {
    body[k] = v;
  }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'SALVATAGGIO...';

  try {
    const res = await fetch('/dashboard/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Configurazione salvata con successo', 'success');
    } else {
      showToast('Errore: ' + (data.error || 'sconosciuto'), 'error');
    }
  } catch (err) {
    showToast('Errore di rete', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">save</span> SALVA CONFIGURAZIONE';
  }
  return false;
}

// --- Init ---
refreshStats();
setInterval(refreshStats, 3000);
</script>
</body></html>`;
}
