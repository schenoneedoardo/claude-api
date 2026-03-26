import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML = readFileSync(resolve(__dirname, "dashboard.html"), "utf-8");

function createProvider(): Provider {
  if (config.provider !== "cli") {
    logger.warn({ requested: config.provider }, "Only 'cli' provider is supported, using CLI");
  }
  return new CliWrapperProvider();
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
    const maskedKey = config.proxyApiKey
      ? config.proxyApiKey.slice(0, 4) + "****" + config.proxyApiKey.slice(-4)
      : "";
    return reply.send({
      proxyApiKey: maskedKey,
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
    const intValidation: Record<string, { min: number; max: number }> = {
      maxRequestsPerMinute: { min: 1, max: 1000 },
      maxConcurrentRequests: { min: 1, max: 50 },
      queueMaxSize: { min: 1, max: 1000 },
      requestTimeoutMs: { min: 5000, max: 600_000 },
      circuitBreakerThreshold: { min: 1, max: 100 },
      circuitBreakerCooldownMs: { min: 1000, max: 600_000 },
    };
    const validLogLevels = ["trace", "debug", "info", "warn", "error", "fatal"];
    const validProviders = ["cli", "token", "browser"];

    for (const key of UPDATABLE_KEYS) {
      if (key in body) {
        const rule = intValidation[key];
        if (rule) {
          const n = parseInt(String(body[key]), 10);
          if (Number.isNaN(n) || n < rule.min || n > rule.max) {
            return reply.status(400).send({
              error: `${key} must be between ${rule.min} and ${rule.max}`,
            });
          }
          updates[key] = n;
        } else if (key === "logLevel") {
          const val = String(body[key]);
          if (!validLogLevels.includes(val)) {
            return reply.status(400).send({ error: `Invalid log level: ${val}` });
          }
          updates[key] = val;
        } else if (key === "provider") {
          const val = String(body[key]);
          if (!validProviders.includes(val)) {
            return reply.status(400).send({ error: `Invalid provider: ${val}` });
          }
          updates[key] = val;
        } else if (key === "proxyApiKey") {
          // Only update if user sent a non-masked value
          const val = String(body[key]);
          if (!val.includes("****")) {
            updates[key] = val;
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
    return reply.type("text/html").send(DASHBOARD_HTML);
  });

  return app;
}
