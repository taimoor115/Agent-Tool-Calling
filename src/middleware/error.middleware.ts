// src/middleware/error.middleware.ts
import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

/**
 * Wraps an async route handler so rejected promises flow into Express's error
 * pipeline instead of crashing the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Thrown by handlers to signal a specific HTTP status + error code. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error middleware. Returns `{ error, code }` — never a stack trace.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : "INTERNAL_ERROR";
  const message = err instanceof Error ? err.message : "Unexpected error";

  logger.error({ err }, "Request failed");

  // Never expose stack traces to the client.
  res.status(statusCode).json({ error: message, code });
}
