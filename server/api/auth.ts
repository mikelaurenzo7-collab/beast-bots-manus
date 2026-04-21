import { Router } from "express";
import { z } from "zod";
import { signSession, verifyAppleIdentityToken } from "../_core/appleAuth";
import { upsertAppleUser } from "../db";
import { HttpError } from "../_core/middleware";

export const authRouter = Router();

const signInSchema = z.object({
  identityToken: z.string().min(1),
  fullName: z
    .object({
      givenName: z.string().optional().nullable(),
      familyName: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  email: z.string().email().optional().nullable(),
});

/**
 * POST /v1/auth/apple
 *
 * Body: { identityToken, fullName?, email? }  (Apple returns fullName/email only
 * on the first sign-in; iOS client forwards them so we can store name on create.)
 *
 * 200: { sessionToken, user: { id, email, name } }
 */
authRouter.post("/apple", async (req, res, next) => {
  try {
    const body = signInSchema.parse(req.body);
    const identity = await verifyAppleIdentityToken(body.identityToken);

    const displayName = [body.fullName?.givenName, body.fullName?.familyName]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim();

    const userId = await upsertAppleUser({
      appleSub: identity.sub,
      email: body.email ?? identity.email ?? null,
      name: displayName.length > 0 ? displayName : null,
    });

    const sessionToken = await signSession({ sub: identity.sub, uid: userId });
    res.json({
      sessionToken,
      user: {
        id: userId,
        email: body.email ?? identity.email ?? null,
        name: displayName || null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new HttpError(400, err.message));
    }
    if (err instanceof Error && /identity token|jwks|audience|issuer/i.test(err.message)) {
      return next(new HttpError(401, "Invalid Apple identity token"));
    }
    next(err);
  }
});
