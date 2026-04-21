import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./middleware";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error("[bot-boss] unhandled", err);
  const msg = err instanceof Error ? err.message : "Internal error";
  res.status(500).json({ error: msg });
}
