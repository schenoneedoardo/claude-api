import type { FastifyInstance } from "fastify";

export const AVAILABLE_MODELS = [
  {
    id: "claude-opus-4-20250514",
    display_name: "Claude Opus 4",
    created_at: "2025-05-14T00:00:00Z",
  },
  {
    id: "claude-sonnet-4-20250514",
    display_name: "Claude Sonnet 4",
    created_at: "2025-05-14T00:00:00Z",
  },
  {
    id: "claude-haiku-3-5-20241022",
    display_name: "Claude 3.5 Haiku",
    created_at: "2024-10-22T00:00:00Z",
  },
  {
    id: "claude-sonnet-4-6-20260310",
    display_name: "Claude Sonnet 4.6",
    created_at: "2026-03-10T00:00:00Z",
  },
  {
    id: "claude-opus-4-6-20260310",
    display_name: "Claude Opus 4.6",
    created_at: "2026-03-10T00:00:00Z",
  },
];

export async function modelsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/models", async (_req, reply) => {
    return reply.send({
      object: "list",
      data: AVAILABLE_MODELS.map((m) => ({
        ...m,
        object: "model",
        owned_by: "anthropic",
      })),
    });
  });
}
