import type { NextFunction, Request, Response } from "express";
import { ENV } from "./env";

/**
 * Minimal CORS + security-header middleware. Zero dependencies.
 *
 * CORS origin allowlist comes from ALLOWED_ORIGINS env (CSV). In dev we
 * additionally allow localhost:5173 (Vite) automatically.
 */
const DEV_EXTRA = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && isAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  if (ENV.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  next();
}

function isAllowed(origin: string): boolean {
  if (ENV.allowedOrigins.includes(origin)) return true;
  if (!ENV.isProduction && DEV_EXTRA.includes(origin)) return true;
  return false;
}
