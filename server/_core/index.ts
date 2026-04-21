import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { ENV } from "./env";
import { authRouter } from "../api/auth";
import { bossRouter } from "../api/boss";
import { connectionsRouter } from "../api/connections";
import { recipesRouter } from "../api/recipes";
import { runsRouter } from "../api/runs";
import { notesRouter } from "../api/notes";
import { devicesRouter } from "../api/devices";
import { errorHandler } from "./errors";
import { requestAuth } from "./middleware";
// Side-effect: register tools.
import "../runtime";

async function main() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "bot-boss", time: new Date().toISOString() });
  });

  // Public endpoints
  app.use("/v1/auth", authRouter);

  // All other v1 routes require a verified session bearer token.
  app.use("/v1", requestAuth);
  app.use("/v1/boss", bossRouter);
  app.use("/v1/connections", connectionsRouter);
  app.use("/v1/recipes", recipesRouter);
  app.use("/v1/runs", runsRouter);
  app.use("/v1/notes", notesRouter);
  app.use("/v1/devices", devicesRouter);

  app.use(errorHandler);

  const server = createServer(app);
  server.listen(ENV.port, () => {
    console.log(`[bot-boss] listening on http://localhost:${ENV.port}`);
  });
}

main().catch((err) => {
  console.error("[bot-boss] fatal:", err);
  process.exit(1);
});
