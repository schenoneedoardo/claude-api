import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { logger } from "../utils/logger.js";

const CREDENTIAL_PATHS = [
  resolve(homedir(), ".claude", "credentials.json"),
  resolve(homedir(), ".config", "claude", "credentials.json"),
];

export interface ClaudeCredentials {
  accessToken?: string;
  sessionToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Attempt to read Claude Code's stored credentials */
export async function readClaudeCredentials(): Promise<ClaudeCredentials | null> {
  for (const path of CREDENTIAL_PATHS) {
    try {
      const raw = await readFile(path, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      logger.debug({ path }, "Found Claude credentials file");
      return {
        accessToken: data.accessToken as string | undefined,
        sessionToken: data.sessionToken as string | undefined,
        refreshToken: data.refreshToken as string | undefined,
        expiresAt: data.expiresAt as number | undefined,
      };
    } catch {
      // File not found or unreadable — try next path
    }
  }
  logger.debug("No Claude credentials file found");
  return null;
}
