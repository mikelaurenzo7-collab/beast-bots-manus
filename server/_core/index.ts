import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { ENV } from "./env";
import { startMissionScheduler } from "./scheduler";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  startMissionScheduler();

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({}),
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(ENV.port, () => {
    console.log(`Bot Boss running on http://localhost:${ENV.port}`);
  });
}

startServer().catch((error) => {
  console.error("[server] failed to start", error);
  process.exitCode = 1;
});