import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../utils/logger.js";
import { ValidationError, ProxyError } from "../utils/errors.js";
import { requestQueue } from "../queue/request-queue.js";
import { SSEHandler } from "../streaming/sse-handler.js";
import type { Provider } from "../providers/base.js";
import type { MessagesRequest } from "../mappers/request-mapper.js";

export async function messagesRoutes(
  app: FastifyInstance,
  provider: Provider,
): Promise<void> {
  app.post(
    "/v1/messages",
    async (
      req: FastifyRequest<{ Body: MessagesRequest }>,
      reply: FastifyReply,
    ) => {
      const body = req.body;

      // Validate required fields
      if (!body.model) {
        throw new ValidationError("'model' is required");
      }
      if (!body.max_tokens || body.max_tokens <= 0) {
        throw new ValidationError("'max_tokens' must be a positive integer");
      }
      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        throw new ValidationError("'messages' must be a non-empty array");
      }

      const startTime = Date.now();

      if (body.stream) {
        // --- Streaming response ---
        const sse = new SSEHandler(reply, body.model);
        sse.init();

        try {
          const response = await requestQueue.enqueue(() => {
            sse.sendMessageStart(body);
            sse.sendContentBlockStart();

            return provider.sendMessageStream(body, (chunk) => {
              sse.sendTextDelta(chunk);
            });
          });

          sse.sendContentBlockStop();
          sse.sendMessageDelta(response.stop_reason, {
            output_tokens: response.usage.output_tokens,
          });
          sse.sendMessageStop();

          logger.info(
            {
              model: body.model,
              durationMs: Date.now() - startTime,
              outputTokens: response.usage.output_tokens,
              stream: true,
            },
            "Streaming request completed",
          );
        } catch (err) {
          const proxyErr =
            err instanceof ProxyError
              ? err
              : new ProxyError(
                  err instanceof Error ? err.message : "Unknown error",
                );

          if (sse.isStarted) {
            sse.sendError({
              type: proxyErr.type,
              message: proxyErr.message,
            });
          } else {
            // SSE not started yet, can still send normal error
            reply.raw.writeHead(proxyErr.statusCode, {
              "Content-Type": "application/json",
            });
            reply.raw.end(JSON.stringify(proxyErr.toJSON()));
          }

          logger.error(
            { err, model: body.model, durationMs: Date.now() - startTime },
            "Streaming request failed",
          );
        }

        // Prevent Fastify from sending another response
        return reply;
      } else {
        // --- Synchronous response ---
        const response = await requestQueue.enqueue(() =>
          provider.sendMessage(body),
        );

        logger.info(
          {
            model: body.model,
            durationMs: Date.now() - startTime,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          "Sync request completed",
        );

        return reply.send(response);
      }
    },
  );
}
