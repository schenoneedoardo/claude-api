/** Base error for all proxy errors */
export class ProxyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly type: string = "proxy_error",
  ) {
    super(message);
    this.name = "ProxyError";
  }

  toJSON(): Record<string, unknown> {
    return {
      type: "error",
      error: {
        type: this.type,
        message: this.message,
      },
    };
  }
}

/** Authentication failure */
export class AuthError extends ProxyError {
  constructor(message = "Invalid API key") {
    super(message, 401, "authentication_error");
    this.name = "AuthError";
  }
}

/** Rate limit exceeded */
export class RateLimitError extends ProxyError {
  constructor(
    message = "Rate limit exceeded",
    public readonly retryAfterMs?: number,
  ) {
    super(message, 429, "rate_limit_error");
    this.name = "RateLimitError";
  }
}

/** Queue is full */
export class QueueFullError extends ProxyError {
  constructor(message = "Service temporarily unavailable — queue is full") {
    super(message, 503, "overloaded_error");
    this.name = "QueueFullError";
  }
}

/** Circuit breaker is open */
export class CircuitOpenError extends ProxyError {
  constructor(message = "Service temporarily unavailable — circuit breaker open") {
    super(message, 503, "overloaded_error");
    this.name = "CircuitOpenError";
  }
}

/** Request timed out */
export class TimeoutError extends ProxyError {
  constructor(message = "Request timed out") {
    super(message, 504, "timeout_error");
    this.name = "TimeoutError";
  }
}

/** Provider error (CLI failed, etc.) */
export class ProviderError extends ProxyError {
  constructor(message: string) {
    super(message, 502, "provider_error");
    this.name = "ProviderError";
  }
}

/** Invalid request */
export class ValidationError extends ProxyError {
  constructor(message: string) {
    super(message, 400, "invalid_request_error");
    this.name = "ValidationError";
  }
}
