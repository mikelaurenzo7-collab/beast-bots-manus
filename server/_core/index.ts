import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { ENV } from "./env";
import { authRouter } from "../api/auth";
import { billingRouter } from "../api/billing";
import { bossRouter } from "../api/boss";
import { connectionsRouter } from "../api/connections";
import { oauthRouter } from "../api/oauth";
import { recipesRouter } from "../api/recipes";
import { runsRouter } from "../api/runs";
import { notesRouter } from "../api/notes";
import { devicesRouter } from "../api/devices";
import { webhooksRouter } from "../api/webhooks";
import { errorHandler } from "./errors";
import { requestAuth } from "./middleware";
import { rateLimit } from "./rateLimit";
import { cors, securityHeaders } from "./security";
import { logger } from "./logger";
import { startScheduler } from "../runtime/scheduler";
// Side-effect: register tools.
import "../runtime";

async function main() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(cors);
  app.use(securityHeaders);

  // Webhook endpoints must see the raw request body for HMAC/signature
  // verification. They are mounted BEFORE express.json() so the raw bytes
  // survive — the routes use their own raw() parser.
  app.use(
    "/v1/webhooks",
    rateLimit({ windowMs: 60_000, max: 600 }),
    webhooksRouter
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "bot-boss", time: new Date().toISOString() });
  });

  app.use("/v1/auth", rateLimit({ windowMs: 60_000, max: 20 }));
  app.use("/v1/auth", authRouter);

  app.use(
    "/v1/oauth",
    rateLimit({ windowMs: 60_000, max: 60 }),
    oauthRouter
  );

  app.use("/v1", requestAuth);
  app.use("/v1", rateLimit({ windowMs: 60_000, max: 240 }));
  app.use("/v1/boss", bossRouter);
  app.use("/v1/billing", billingRouter);
  app.use("/v1/connections", connectionsRouter);
  app.use("/v1/recipes", recipesRouter);
  app.use("/v1/runs", runsRouter);
  app.use("/v1/notes", notesRouter);
  app.use("/v1/devices", devicesRouter);

  app.use(errorHandler);

  const server = createServer(app);
  server.listen(ENV.port, () => {
    logger.info("server listening", {
      port: ENV.port,
      env: ENV.isProduction ? "production" : "development",
    });
    startScheduler();
  });

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      logger.info("shutdown signal", { sig });
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  logger.error("fatal boot error", { err: String(err) });
  process.exit(1);
});
