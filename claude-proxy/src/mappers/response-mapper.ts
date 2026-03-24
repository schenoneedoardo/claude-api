import { randomUUID } from "node:crypto";
import type { MessagesResponse, ContentBlock, Usage } from "./request-mapper.js";

/** Raw JSON output from `claude -p --output-format json` */
export interface CliJsonOutput {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  stop_reason?: string;
  session_id: string;
  duration_ms: number;
  total_cost_usd: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/** Map raw CLI JSON to Anthropic Messages API response */
export function mapCliOutputToResponse(
  raw: CliJsonOutput,
  model: string,
): MessagesResponse {
  const content: ContentBlock[] = [{ type: "text", text: raw.result }];

  const stopReason = mapStopReason(raw.stop_reason);

  const usage: Usage = {
    input_tokens:
      (raw.usage?.input_tokens ?? 0) +
      (raw.usage?.cache_creation_input_tokens ?? 0) +
      (raw.usage?.cache_read_input_tokens ?? 0),
    output_tokens: raw.usage?.output_tokens ?? 0,
  };

  return {
    id: `msg_${randomUUID().replace(/-/g, "")}`,
    type: "message",
    role: "assistant",
    content,
    model,
    stop_reason: stopReason,
    usage,
  };
}

function mapStopReason(
  reason?: string,
): "end_turn" | "max_tokens" | "stop_sequence" {
  if (reason === "max_tokens") return "max_tokens";
  if (reason === "stop_sequence") return "stop_sequence";
  return "end_turn";
}

/** Raw stream-json chunk from `claude -p --output-format stream-json` */
export interface CliStreamChunk {
  type: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  session_id?: string;
  stop_reason?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}
