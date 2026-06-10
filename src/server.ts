// src/server.ts
import express from "express";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { agentRouter } from "./routes/agent.routes";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

app.use(express.json());

// Health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// All API routes live under /api.
app.use("/api", agentRouter);

// Global error handler — must be registered last.
app.use(errorMiddleware);

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 DevAgent listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown.
const shutdown = (signal: string): void => {
  logger.info(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app };
