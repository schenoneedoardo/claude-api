import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { MessagesRequest } from "../mappers/request-mapper.js";

/**
 * Helper to send SSE events in Anthropic Messages API streaming format.
 */
export class SSEHandler {
  private readonly messageId: string;
  private blockIndex = 0;
  private started = false;

  constructor(
    private readonly reply: FastifyReply,
    private readonly model: string,
  ) {
    this.messageId = `msg_${randomUUID().replace(/-/g, "")}`;
  }

  /** Set up the response headers for SSE */
  init(): void {
    this.reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
  }

  /** Send the message_start event */
  sendMessageStart(_request: MessagesRequest): void {
    this.started = true;
    this.sendEvent("message_start", {
      type: "message_start",
      message: {
        id: this.messageId,
        type: "message",
        role: "assistant",
        content: [],
        model: this.model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      },
    });
  }

  /** Send content_block_start */
  sendContentBlockStart(): void {
    this.sendEvent("content_block_start", {
      type: "content_block_start",
      index: this.blockIndex,
      content_block: {
        type: "text",
        text: "",
      },
    });
  }

  /** Send a text delta */
  sendTextDelta(text: string): void {
    this.sendEvent("content_block_delta", {
      type: "content_block_delta",
      index: this.blockIndex,
      delta: {
        type: "text_delta",
        text,
      },
    });
  }

  /** Send content_block_stop */
  sendContentBlockStop(): void {
    this.sendEvent("content_block_stop", {
      type: "content_block_stop",
      index: this.blockIndex,
    });
    this.blockIndex++;
  }

  /** Send message_delta (final stop reason + usage) */
  sendMessageDelta(
    stopReason: "end_turn" | "max_tokens" | "stop_sequence",
    usage: { output_tokens: number },
  ): void {
    this.sendEvent("message_delta", {
      type: "message_delta",
      delta: {
        stop_reason: stopReason,
        stop_sequence: null,
      },
      usage,
    });
  }

  /** Send message_stop and end the stream */
  sendMessageStop(): void {
    this.sendEvent("message_stop", { type: "message_stop" });
    this.reply.raw.end();
  }

  /** Send an error event and close */
  sendError(error: { type: string; message: string }): void {
    this.sendEvent("error", {
      type: "error",
      error,
    });
    this.reply.raw.end();
  }

  /** Send a ping (keep-alive) */
  sendPing(): void {
    this.reply.raw.write(": ping\n\n");
  }

  get isStarted(): boolean {
    return this.started;
  }

  private sendEvent(event: string, data: unknown): void {
    this.reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
