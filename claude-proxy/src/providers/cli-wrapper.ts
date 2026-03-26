import { spawn } from "node:child_process";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ProviderError } from "../utils/errors.js";
import type { Provider, StreamChunkCallback } from "./base.js";
import type { MessagesRequest, MessagesResponse } from "../mappers/request-mapper.js";
import { buildPromptFromMessages } from "../mappers/request-mapper.js";
import {
  mapCliOutputToResponse,
  type CliJsonOutput,
  type CliStreamChunk,
} from "../mappers/response-mapper.js";
import { randomUUID } from "node:crypto";

export class CliWrapperProvider implements Provider {
  readonly name = "cli-wrapper";

  /** Send a synchronous message via `claude -p --output-format json` */
  async sendMessage(request: MessagesRequest): Promise<MessagesResponse> {
    const prompt = buildPromptFromMessages(request.messages, request.system);
    const args = this.buildArgs(request, "json");

    logger.debug({ args, promptLength: prompt.length }, "Spawning Claude CLI (sync)");

    const raw = await this.spawnClaude(args, prompt);
    let parsed: CliJsonOutput;
    try {
      parsed = JSON.parse(raw) as CliJsonOutput;
    } catch {
      throw new ProviderError(`Failed to parse CLI JSON output: ${raw.slice(0, 200)}`);
    }

    if (parsed.is_error) {
      throw new ProviderError(`CLI returned error: ${parsed.result}`);
    }

    return mapCliOutputToResponse(parsed, request.model);
  }

  /** Send a streaming message via `claude -p --output-format stream-json` */
  async sendMessageStream(
    request: MessagesRequest,
    onChunk: StreamChunkCallback,
  ): Promise<MessagesResponse> {
    const prompt = buildPromptFromMessages(request.messages, request.system);
    const args = this.buildArgs(request, "stream-json");
    args.push("--include-partial-messages");

    logger.debug({ args, promptLength: prompt.length }, "Spawning Claude CLI (stream)");

    return new Promise<MessagesResponse>((resolve, reject) => {
      const proc = spawn(config.claudeCliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let fullText = "";
      let lastChunk: CliStreamChunk | undefined;
      let stderr = "";

      proc.stdin.write(prompt);
      proc.stdin.end();

      let buffer = "";
      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const chunk = JSON.parse(trimmed) as CliStreamChunk;
            lastChunk = chunk;

            if (chunk.type === "assistant" && chunk.subtype === "text") {
              // This is a partial text message
              if (chunk.result !== undefined) {
                const delta = chunk.result.slice(fullText.length);
                if (delta) {
                  fullText = chunk.result;
                  onChunk(delta);
                }
              }
            } else if (chunk.type === "result") {
              // Final result
              if (chunk.result !== undefined) {
                const delta = chunk.result.slice(fullText.length);
                if (delta) {
                  fullText = chunk.result;
                  onChunk(delta);
                }
              }
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf-8");
      });

      proc.on("close", (code) => {
        if (code !== 0 && !lastChunk) {
          reject(new ProviderError(`CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
          return;
        }

        const usage = {
          input_tokens:
            (lastChunk?.usage?.input_tokens ?? 0) +
            (lastChunk?.usage?.cache_creation_input_tokens ?? 0) +
            (lastChunk?.usage?.cache_read_input_tokens ?? 0),
          output_tokens: lastChunk?.usage?.output_tokens ?? 0,
        };

        resolve({
          id: `msg_${randomUUID().replace(/-/g, "")}`,
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: fullText }],
          model: request.model,
          stop_reason: lastChunk?.stop_reason === "max_tokens" ? "max_tokens" : "end_turn",
          usage,
        });
      });

      proc.on("error", (err) => {
        reject(new ProviderError(`Failed to spawn CLI: ${err.message}`));
      });
    });
  }

  private buildArgs(request: MessagesRequest, outputFormat: "json" | "stream-json"): string[] {
    const args = ["-p", "--output-format", outputFormat, "--dangerously-skip-permissions"];
    if (outputFormat === "stream-json") {
      args.push("--verbose");
    }
    if (request.model) {
      args.push("--model", request.model);
    }
    return args;
  }

  /** Spawn the Claude CLI and collect all stdout */
  private spawnClaude(args: string[], stdinData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(config.claudeCliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdin.write(stdinData);
      proc.stdin.end();

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString("utf-8");
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf-8");
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new ProviderError(
              `CLI exited with code ${code}: ${stderr.slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve(stdout.trim());
      });

      proc.on("error", (err) => {
        reject(new ProviderError(`Failed to spawn CLI: ${err.message}`));
      });
    });
  }
}
