import type { MessagesRequest, MessagesResponse } from "../mappers/request-mapper.js";

/** Callback for streaming chunks */
export type StreamChunkCallback = (chunk: string) => void;

/** Abstract provider interface */
export interface Provider {
  /** Human-readable name */
  readonly name: string;

  /** Send a synchronous message and return the full response */
  sendMessage(request: MessagesRequest): Promise<MessagesResponse>;

  /**
   * Send a streaming message.
   * Calls `onChunk` for each incremental text piece.
   * Returns the final assembled response.
   */
  sendMessageStream(
    request: MessagesRequest,
    onChunk: StreamChunkCallback,
  ): Promise<MessagesResponse>;
}
