import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { QueueFullError, CircuitOpenError, TimeoutError } from "../utils/errors.js";
import { RateLimiter, CircuitBreaker } from "./rate-limiter.js";

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
}

/**
 * FIFO request queue with rate limiting, concurrency control, and circuit breaker.
 */
export class RequestQueue {
  private readonly queue: QueuedRequest<unknown>[] = [];
  private activeCount = 0;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private processing = false;

  // Metrics
  private _totalRequests = 0;
  private _totalErrors = 0;
  private _totalCompleted = 0;

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
  }

  /** Enqueue a request. Rejects immediately if queue is full or circuit is open. */
  enqueue<T>(execute: () => Promise<T>): Promise<T> {
    if (!this.circuitBreaker.isAllowed()) {
      return Promise.reject(new CircuitOpenError());
    }

    if (this.queue.length >= config.queueMaxSize) {
      return Promise.reject(new QueueFullError());
    }

    this._totalRequests++;

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
      });

      logger.debug(
        { queueSize: this.queue.length, active: this.activeCount },
        "Request enqueued",
      );

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0 && this.activeCount < config.maxConcurrentRequests) {
        const item = this.queue[0];
        if (!item) break;

        // Check timeout
        const elapsed = Date.now() - item.enqueuedAt;
        if (elapsed > config.requestTimeoutMs) {
          this.queue.shift();
          item.reject(new TimeoutError("Request timed out while queued"));
          continue;
        }

        // Wait for rate limit token
        if (!this.rateLimiter.tryAcquire()) {
          const waitMs = this.rateLimiter.msUntilNextToken();
          logger.debug({ waitMs }, "Waiting for rate limit token");
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 100)));
          continue;
        }

        // Check circuit breaker again
        if (!this.circuitBreaker.isAllowed()) {
          // Reject all queued
          while (this.queue.length > 0) {
            const rejected = this.queue.shift()!;
            rejected.reject(new CircuitOpenError());
          }
          break;
        }

        // Dequeue and execute
        this.queue.shift();
        this.activeCount++;

        // Fire and forget — we handle resolution inside
        this.executeItem(item);
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeItem(item: QueuedRequest<unknown>): Promise<void> {
    try {
      const result = await item.execute();
      this.circuitBreaker.recordSuccess();
      this._totalCompleted++;
      item.resolve(result);
    } catch (err) {
      this.circuitBreaker.recordFailure();
      this._totalErrors++;
      item.reject(err);
    } finally {
      this.activeCount--;
      // Trigger next processing cycle
      this.processNext();
    }
  }

  /** Monitoring stats */
  get stats(): {
    queueSize: number;
    activeRequests: number;
    totalRequests: number;
    totalCompleted: number;
    totalErrors: number;
    circuitState: string;
    availableTokens: number;
  } {
    return {
      queueSize: this.queue.length,
      activeRequests: this.activeCount,
      totalRequests: this._totalRequests,
      totalCompleted: this._totalCompleted,
      totalErrors: this._totalErrors,
      circuitState: this.circuitBreaker.currentState,
      availableTokens: this.rateLimiter.availableTokens,
    };
  }
}

/** Singleton queue instance */
export const requestQueue = new RequestQueue();
