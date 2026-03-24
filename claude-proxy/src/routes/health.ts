import type { FastifyInstance } from "fastify";
import { requestQueue } from "../queue/request-queue.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_req, reply) => {
    const stats = requestQueue.stats;
    return reply.send({
      status: "ok",
      uptime: process.uptime(),
      queue: stats,
    });
  });
}
