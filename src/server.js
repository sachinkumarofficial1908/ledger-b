import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env, validateEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start() {
  validateEnv();
  await connectDB();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server started [${env.NODE_ENV}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
