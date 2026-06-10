// src/middleware/validate.middleware.ts
import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError } from "./error.middleware";

/**
 * Validates `req.body` against a Zod schema. On failure throws an AppError
 * (400) with a clear message; on success replaces the body with the parsed
 * (typed) value.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError(400, message, "VALIDATION_ERROR");
    }
    req.body = result.data;
    next();
  };
}
