import { Router } from "express";
import { listRuns } from "../db";
import { requireUserId } from "../_core/middleware";

export const runsRouter = Router();

/** GET /v1/runs  → recent runs for the signed-in user (newest first). */
runsRouter.get("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
    res.json({ runs: await listRuns(userId, limit) });
  } catch (err) {
    next(err);
  }
});
