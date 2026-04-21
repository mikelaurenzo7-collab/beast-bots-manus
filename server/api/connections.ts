import { Router } from "express";
import { z } from "zod";
import { deleteConnection, listConnections, saveConnection } from "../db";
import { HttpError, requireUserId } from "../_core/middleware";

export const connectionsRouter = Router();

/** GET /v1/connections  → list of providers the user has connected. */
connectionsRouter.get("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    res.json({ connections: await listConnections(userId) });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  provider: z.string().min(1).max(64),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
});

/**
 * POST /v1/connections
 *
 * Bring-your-own token flow — the iOS app does the OAuth dance in
 * ASWebAuthenticationSession and posts the resulting token here. We never see
 * the user's OAuth secret; tokens are encrypted at rest with AES-256-GCM.
 */
connectionsRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = upsertSchema.parse(req.body);
    await saveConnection({
      userId,
      provider: body.provider,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      accountId: body.accountId,
      accountName: body.accountName,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

/** DELETE /v1/connections/:provider */
connectionsRouter.delete("/:provider", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    await deleteConnection(userId, req.params.provider);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
