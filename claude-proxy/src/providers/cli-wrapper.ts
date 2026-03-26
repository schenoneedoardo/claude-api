import { spawn, type ChildProcess } from "node:child_process";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ProviderError, TimeoutError } from "../utils/errors.js";
import type { Provider, StreamChunkCallback } from "./base.js";
import type { MessagesRequest, MessagesResponse } from "../mappers/request-mapper.js";
import { buildPromptFromMessages } from "../mappers/request-mapper.js";
import {
  mapCliOutputToResponse,
  type CliJsonOutput,
  type CliStreamChunk,
} from "../mappers/response-mapper.js";
import { randomUUID } from "node:crypto";

/** Kill a child process and reject with TimeoutError */
function killWithTimeout(proc: ChildProcess, reject: (err: Error) => void): void {
  proc.kill("SIGTERM");
  reject(new TimeoutError(`CLI process timed out after ${config.requestTimeoutMs}ms`));
}

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
      let settled = false;
      const safeReject = (err: Error) => { if (!settled) { settled = true; reject(err); } };
      const safeResolve = (val: MessagesResponse) => { if (!settled) { settled = true; resolve(val); } };

      const proc = spawn(config.claudeCliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      const timeout = setTimeout(() => killWithTimeout(proc, safeReject), config.requestTimeoutMs);

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
        clearTimeout(timeout);

        if (code !== 0 && !lastChunk) {
          safeReject(new ProviderError(`CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
          return;
        }

        const usage = {
          input_tokens:
            (lastChunk?.usage?.input_tokens ?? 0) +
            (lastChunk?.usage?.cache_creation_input_tokens ?? 0) +
            (lastChunk?.usage?.cache_read_input_tokens ?? 0),
          output_tokens: lastChunk?.usage?.output_tokens ?? 0,
        };

        safeResolve({
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
        clearTimeout(timeout);
        safeReject(new ProviderError(`Failed to spawn CLI: ${err.message}`));
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
    if (request.max_tokens) {
      args.push("--max-turns", String(request.max_tokens));
    }
    if (request.temperature !== undefined) {
      args.push("--temperature", String(request.temperature));
    }
    if (request.top_p !== undefined) {
      args.push("--top-p", String(request.top_p));
    }
    if (request.top_k !== undefined) {
      args.push("--top-k", String(request.top_k));
    }
    if (request.stop_sequences?.length) {
      for (const seq of request.stop_sequences) {
        args.push("--stop-sequence", seq);
      }
    }
    return args;
  }

  /** Spawn the Claude CLI and collect all stdout */
  private spawnClaude(args: string[], stdinData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const safeReject = (err: Error) => { if (!settled) { settled = true; reject(err); } };
      const safeResolve = (val: string) => { if (!settled) { settled = true; resolve(val); } };

      const proc = spawn(config.claudeCliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      const timeout = setTimeout(() => killWithTimeout(proc, safeReject), config.requestTimeoutMs);

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
        clearTimeout(timeout);
        if (code !== 0) {
          safeReject(
            new ProviderError(
              `CLI exited with code ${code}: ${stderr.slice(0, 500)}`,
            ),
          );
          return;
        }
        safeResolve(stdout.trim());
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        safeReject(new ProviderError(`Failed to spawn CLI: ${err.message}`));
      });
    });
  }
}
