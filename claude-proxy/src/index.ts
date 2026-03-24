import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const app = await buildServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ host: config.host, port: config.port });
    logger.info(
      { host: config.host, port: config.port, provider: config.provider },
      `Claude Proxy running at http://${config.host}:${config.port}`,
    );
    logger.info(`Dashboard: http://${config.host}:${config.port}/dashboard`);
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main();
