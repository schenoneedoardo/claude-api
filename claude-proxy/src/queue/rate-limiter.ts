import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Token-bucket rate limiter.
 * Refills tokens at a constant rate up to `maxTokens`.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRateMs: number;
  private lastRefill: number;

  constructor(maxPerMinute: number = config.maxRequestsPerMinute) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillRateMs = 60_000 / maxPerMinute; // ms per token
    this.lastRefill = Date.now();
  }

  /** Refill tokens based on elapsed time */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillRateMs);
    if (newTokens > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  /** Try to consume one token. Returns true if allowed. */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /** Estimated ms until next token is available */
  msUntilNextToken(): number {
    this.refill();
    if (this.tokens > 0) return 0;
    return this.refillRateMs - (Date.now() - this.lastRefill);
  }

  /** Wait until a token is available, then consume it */
  async waitForToken(): Promise<void> {
    while (!this.tryAcquire()) {
      const wait = this.msUntilNextToken();
      logger.debug({ waitMs: wait }, "Rate limiter: waiting for token");
      await new Promise((r) => setTimeout(r, Math.max(wait, 100)));
    }
  }

  /** Current available tokens (for monitoring) */
  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Circuit breaker — opens after N consecutive failures,
 * blocks requests during cooldown.
 */
export class CircuitBreaker {
  private failures = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private openedAt = 0;

  constructor(
    private readonly threshold: number = config.circuitBreakerThreshold,
    private readonly cooldownMs: number = config.circuitBreakerCooldownMs,
  ) {}

  /** Check if the circuit allows a request through */
  isAllowed(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.cooldownMs) {
        this.state = "half-open";
        logger.info("Circuit breaker: half-open, allowing probe request");
        return true;
      }
      return false;
    }

    // half-open: allow one probe
    return true;
  }

  /** Report a successful request */
  recordSuccess(): void {
    this.failures = 0;
    if (this.state !== "closed") {
      logger.info("Circuit breaker: closed (recovered)");
      this.state = "closed";
    }
  }

  /** Report a failed request */
  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold && this.state !== "open") {
      this.state = "open";
      this.openedAt = Date.now();
      logger.warn(
        { failures: this.failures, cooldownMs: this.cooldownMs },
        "Circuit breaker: OPEN",
      );
    }
  }

  /** Current state (for monitoring) */
  get currentState(): string {
    // Re-check if we should transition from open to half-open
    if (this.state === "open" && Date.now() - this.openedAt >= this.cooldownMs) {
      return "half-open";
    }
    return this.state;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }
}
