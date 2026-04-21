import type { NextFunction, Request, Response } from "express";
import { verifySession } from "./appleAuth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      appleSub?: string;
    }
  }
}

export async function requestAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = header.slice(7).trim();
  try {
    const claims = await verifySession(token);
    req.userId = claims.uid;
    req.appleSub = claims.sub;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid session", detail: err instanceof Error ? err.message : String(err) });
  }
}

export function requireUserId(req: Request): number {
  if (typeof req.userId !== "number") {
    throw new HttpError(401, "Not authenticated");
  }
  return req.userId;
}

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
