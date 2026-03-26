import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync, renameSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../../.env");

dotenvConfig({ path: ENV_PATH });

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export interface Config {
  /** Server host */
  host: string;
  /** Server port */
  port: number;
  /** API key for proxy authentication */
  proxyApiKey: string;
  /** Provider type: cli | token | browser */
  provider: "cli" | "token" | "browser";
  /** Path to Claude Code CLI */
  claudeCliPath: string;
  /** Max requests per minute */
  maxRequestsPerMinute: number;
  /** Max concurrent requests */
  maxConcurrentRequests: number;
  /** Max queue size */
  queueMaxSize: number;
  /** Request timeout in ms */
  requestTimeoutMs: number;
  /** Circuit breaker: max consecutive failures before opening */
  circuitBreakerThreshold: number;
  /** Circuit breaker: cooldown in ms */
  circuitBreakerCooldownMs: number;
  /** Log level */
  logLevel: string;
}

export const config: Config = {
  host: envStr("HOST", "127.0.0.1"),
  port: envInt("PORT", 3456),
  proxyApiKey: envStr("PROXY_API_KEY", ""),
  provider: envStr("PROVIDER", "cli") as Config["provider"],
  claudeCliPath: envStr("CLAUDE_CLI_PATH", "claude"),
  maxRequestsPerMinute: envInt("MAX_REQUESTS_PER_MINUTE", 10),
  maxConcurrentRequests: envInt("MAX_CONCURRENT_REQUESTS", 2),
  queueMaxSize: envInt("QUEUE_MAX_SIZE", 50),
  requestTimeoutMs: envInt("REQUEST_TIMEOUT_MS", 120_000),
  circuitBreakerThreshold: envInt("CIRCUIT_BREAKER_THRESHOLD", 5),
  circuitBreakerCooldownMs: envInt("CIRCUIT_BREAKER_COOLDOWN_MS", 60_000),
  logLevel: envStr("LOG_LEVEL", "info"),
};

/** Map of config keys to .env variable names */
const CONFIG_TO_ENV: Record<string, string> = {
  host: "HOST",
  port: "PORT",
  proxyApiKey: "PROXY_API_KEY",
  provider: "PROVIDER",
  claudeCliPath: "CLAUDE_CLI_PATH",
  maxRequestsPerMinute: "MAX_REQUESTS_PER_MINUTE",
  maxConcurrentRequests: "MAX_CONCURRENT_REQUESTS",
  queueMaxSize: "QUEUE_MAX_SIZE",
  requestTimeoutMs: "REQUEST_TIMEOUT_MS",
  circuitBreakerThreshold: "CIRCUIT_BREAKER_THRESHOLD",
  circuitBreakerCooldownMs: "CIRCUIT_BREAKER_COOLDOWN_MS",
  logLevel: "LOG_LEVEL",
};

/** Updatable config keys (excludes host/port which require restart) */
export const UPDATABLE_KEYS = [
  "proxyApiKey",
  "provider",
  "claudeCliPath",
  "maxRequestsPerMinute",
  "maxConcurrentRequests",
  "queueMaxSize",
  "requestTimeoutMs",
  "circuitBreakerThreshold",
  "circuitBreakerCooldownMs",
  "logLevel",
] as const;

/** Update config in memory and persist to .env file */
export function updateConfig(
  updates: Partial<Pick<Config, (typeof UPDATABLE_KEYS)[number]>>,
): void {
  // Update in-memory config
  for (const key of UPDATABLE_KEYS) {
    if (key in updates) {
      (config as unknown as Record<string, unknown>)[key] = updates[key];
    }
  }

  // Rebuild the .env file
  let envContent: string;
  try {
    envContent = readFileSync(ENV_PATH, "utf-8");
  } catch {
    envContent = "";
  }

  const lines = envContent.split("\n");

  for (const [configKey, envKey] of Object.entries(CONFIG_TO_ENV)) {
    const value = (config as unknown as Record<string, unknown>)[configKey];
    const lineIdx = lines.findIndex(
      (l) => l.startsWith(`${envKey}=`) || l.startsWith(`# ${envKey}=`),
    );
    const newLine = `${envKey}=${String(value)}`;
    if (lineIdx >= 0) {
      lines[lineIdx] = newLine;
    } else {
      lines.push(newLine);
    }
  }

  const tmpPath = ENV_PATH + ".tmp";
  writeFileSync(tmpPath, lines.join("\n"), "utf-8");
  renameSync(tmpPath, ENV_PATH);
}
