/** Content block types (compatible with Anthropic API) */
export interface TextBlock {
  type: "text";
  text: string;
}

export interface ImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type ContentBlock = TextBlock | ImageBlock;

/** A single message in the conversation */
export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

/** Request body — compatible with POST /v1/messages */
export interface MessagesRequest {
  model: string;
  max_tokens: number;
  messages: Message[];
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop_sequences?: string[];
  metadata?: Record<string, string>;
}

/** Usage info */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** Response body — compatible with Anthropic Messages API */
export interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: Usage;
}

/**
 * Build a single text prompt from the Messages API format.
 * Used by the CLI wrapper which accepts a single string prompt.
 */
export function buildPromptFromMessages(
  messages: Message[],
  system?: string,
): string {
  const parts: string[] = [];

  if (system) {
    parts.push(`[System]\n${system}\n`);
  }

  for (const msg of messages) {
    const role = msg.role === "user" ? "Human" : "Assistant";
    const text =
      typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter((b): b is TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n");
    parts.push(`[${role}]\n${text}\n`);
  }

  return parts.join("\n");
}
