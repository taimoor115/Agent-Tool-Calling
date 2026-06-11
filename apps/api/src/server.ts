// src/server.ts
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { agentRouter } from "./routes/agent.routes";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

// Allow the web frontend (different origin/port) to call this API, including
// the SSE stream. CORS_ORIGIN can be a comma-separated allowlist; defaults to
// "*" in development for convenience.
const corsOrigins = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(cors({ origin: corsOrigins }));

app.use(express.json());

// Health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// All API routes live under /api.
app.use("/api", agentRouter);

// Global error handler — must be registered last.
app.use(errorMiddleware);

// In Vercel serverless the runtime manages the HTTP server; only bind locally.
if (!process.env.VERCEL) {
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 DevAgent listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

export { app };
export default app;
