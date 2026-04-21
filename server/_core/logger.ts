/**
 * Minimal structured logger. Emits JSON lines in production (friendly for
 * log aggregators); falls back to pretty single-line output in dev.
 *
 * Deliberately zero-dep. Swap for pino/winston if you outgrow it, but the
 * surface is stable: logger.info / warn / error / debug, each taking a
 * message + optional structured fields.
 */
import { ENV } from "./env";

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  const rec = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...(fields ?? {}),
  };
  if (ENV.isProduction) {
    // One JSON line; safe to ingest directly.
    process.stdout.write(JSON.stringify(rec) + "\n");
    return;
  }
  // Dev: readable single line.
  const tag =
    level === "error" ? "[ERR ]" :
    level === "warn"  ? "[WARN]" :
    level === "debug" ? "[dbg ]" :
                        "[INFO]";
  const extras = fields && Object.keys(fields).length > 0
    ? "  " + Object.entries(fields).map(([k, v]) => `${k}=${stringify(v)}`).join(" ")
    : "";
  process.stdout.write(`${tag} ${message}${extras}\n`);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
