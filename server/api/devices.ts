import { Router } from "express";
import { z } from "zod";
import { deleteDeviceToken, upsertDeviceToken } from "../db";
import { ENV } from "../_core/env";
import { HttpError, requireUserId } from "../_core/middleware";

export const devicesRouter = Router();

const registerSchema = z.object({
  deviceToken: z.string().min(16),
  bundleId: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
});

/**
 * POST /v1/devices  — iOS app registers its APNs device token on launch.
 */
devicesRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = registerSchema.parse(req.body);
    await upsertDeviceToken({
      userId,
      deviceToken: body.deviceToken,
      bundleId: body.bundleId ?? ENV.apnsBundleId,
      environment: body.environment ?? ENV.apnsEnvironment,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

devicesRouter.delete("/:token", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    await deleteDeviceToken(userId, req.params.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
