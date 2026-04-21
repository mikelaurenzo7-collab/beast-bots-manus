import type { NextFunction, Request, Response } from "express";

/**
 * In-memory token bucket keyed by IP. Good enough for a single-process
 * deployment; swap for Redis when we horizontally scale.
 *
 * Usage:
 *   app.use("/v1/auth", rateLimit({ windowMs: 60_000, max: 20 }));
 */
type Bucket = { count: number; resetAt: number };

export function rateLimit({
  windowMs,
  max,
  keyGenerator,
}: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();
  const keyFn = keyGenerator ?? ((req: Request) => clientIp(req));

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyFn(req);
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - b.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(b.resetAt / 1000)));
    if (b.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}
