import { logger } from "../utils/logger.js";

/**
 * Placeholder session manager for future providers (token-proxy, browser-session).
 * The CLI wrapper delegates session management to Claude Code itself.
 */
export class SessionManager {
  private active = false;

  async initialize(): Promise<void> {
    this.active = true;
    logger.info("Session manager initialized (CLI wrapper mode — delegated to Claude Code)");
  }

  isActive(): boolean {
    return this.active;
  }

  async destroy(): Promise<void> {
    this.active = false;
  }
}

export const sessionManager = new SessionManager();
