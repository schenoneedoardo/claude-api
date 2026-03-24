import { logger } from "../utils/logger.js";

/**
 * Placeholder for OAuth token refresh logic.
 * The CLI wrapper approach doesn't need this since Claude Code
 * handles its own auth. This is scaffolded for the token-proxy provider.
 */
export async function refreshTokenIfNeeded(
  _expiresAt?: number,
  _refreshToken?: string,
): Promise<string | null> {
  logger.debug("Token refresh not implemented for CLI wrapper provider");
  return null;
}
