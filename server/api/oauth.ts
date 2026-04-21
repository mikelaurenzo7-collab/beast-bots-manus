import { Router } from "express";
import { z } from "zod";
import { HttpError, requireUserId, requestAuth } from "../_core/middleware";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateState,
  redirectUriFor,
} from "../_core/oauth";
import { getProvider } from "../providers";
import {
  consumeOAuthState,
  createOAuthState,
  saveConnection,
} from "../db";
import { logger } from "../_core/logger";

export const oauthRouter = Router();

const STATE_TTL_MS = 10 * 60 * 1000;

const startSchema = z.object({
  returnTo: z.string().url().optional(),
  shop: z.string().max(256).optional(),
});

/**
 * POST /v1/oauth/:provider/start
 *
 * Auth required. Generates state + optional PKCE, stores them bound to this
 * user, returns the provider's authorize URL for the client to navigate to.
 *
 * Body: { returnTo?, shop? (required for Shopify) }
 * Returns: { authorizeUrl }
 */
oauthRouter.post("/:provider/start", requestAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const providerId = req.params.provider;
    const provider = getProvider(providerId);
    if (!provider) throw new HttpError(404, `Unknown provider ${providerId}`);

    const body = startSchema.parse(req.body ?? {});

    if (provider.requiresShop && !body.shop) {
      throw new HttpError(400, "This provider requires a shop domain");
    }

    const state = generateState();
    const codeVerifier = provider.usesPKCE ? generateCodeVerifier() : undefined;
    const codeChallenge = codeVerifier ? codeChallengeS256(codeVerifier) : undefined;

    await createOAuthState({
      state,
      userId,
      providerId,
      codeVerifier,
      shop: body.shop,
      returnTo: body.returnTo,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });

    const authorizeUrl = provider.buildAuthorizeUrl({
      state,
      redirectUri: redirectUriFor(providerId),
      codeChallenge,
      shop: body.shop,
      scopes: provider.scopes,
    });

    res.json({ authorizeUrl });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

/**
 * GET /v1/oauth/:provider/callback?code=...&state=...
 *
 * Public — we trust the state column to match the code to a user. Exchanges
 * the auth code for tokens, stores encrypted, then 302-redirects the browser
 * back to `returnTo` (or a default dashboard route).
 */
oauthRouter.get("/:provider/callback", async (req, res, next) => {
  try {
    const providerId = req.params.provider;
    const provider = getProvider(providerId);
    if (!provider) throw new HttpError(404, `Unknown provider ${providerId}`);

    const code = req.query.code;
    const stateParam = req.query.state;
    if (typeof code !== "string" || typeof stateParam !== "string") {
      throw new HttpError(400, "Missing code or state");
    }

    const stateRow = await consumeOAuthState(stateParam);
    if (!stateRow || stateRow.providerId !== providerId) {
      throw new HttpError(400, "Invalid or expired state");
    }

    const redirectUri = redirectUriFor(providerId);
    const exchange = await provider.exchangeToken({
      code,
      redirectUri,
      codeVerifier: stateRow.codeVerifier ?? undefined,
      shop: stateRow.shop ?? undefined,
    });

    let account = { accountId: undefined as string | undefined, accountName: undefined as string | undefined };
    if (provider.identify) {
      try {
        account = await provider.identify(exchange.accessToken, {
          code,
          redirectUri,
          codeVerifier: stateRow.codeVerifier ?? undefined,
          shop: stateRow.shop ?? undefined,
        });
      } catch (err) {
        logger.warn("provider.identify failed", { providerId, err: String(err) });
      }
    }

    await saveConnection({
      userId: stateRow.userId,
      provider: providerId,
      accessToken: exchange.accessToken,
      refreshToken: exchange.refreshToken,
      scopes: exchange.scopes,
      expiresAt: exchange.expiresInSeconds
        ? new Date(Date.now() + exchange.expiresInSeconds * 1000)
        : undefined,
      accountId: account.accountId ?? stateRow.shop ?? undefined,
      accountName: account.accountName,
    });

    // Fire-and-forget postConnect (webhook registration, cache warming, etc.).
    // Never block the user's redirect on these side effects.
    if (provider.postConnect) {
      provider
        .postConnect({
          userId: stateRow.userId,
          accessToken: exchange.accessToken,
          accountId: account.accountId ?? stateRow.shop ?? undefined,
          shop: stateRow.shop ?? undefined,
          publicBaseUrl: (await import("../_core/env")).ENV.publicBaseUrl,
        })
        .catch((err) =>
          logger.warn("postConnect failed", { providerId, err: String(err) })
        );
    }

    const returnTo = stateRow.returnTo ?? "/connections?connected=" + providerId;
    res.redirect(302, returnTo);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/oauth/kalshi/connect
 *
 * Kalshi uses API keys, not OAuth. Users paste their key; we validate it
 * with a ping to /portfolio/balance, then store encrypted.
 */
const kalshiSchema = z.object({
  apiKey: z.string().min(10).max(1024),
});

oauthRouter.post("/kalshi/connect", requestAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = kalshiSchema.parse(req.body);
    const ping = await fetch(
      "https://api.elections.kalshi.com/trade-api/v2/portfolio/balance",
      { headers: { Authorization: `Bearer ${body.apiKey}`, Accept: "application/json" } }
    );
    if (!ping.ok) {
      throw new HttpError(401, "Kalshi rejected that API key");
    }
    const data = (await ping.json()) as { balance?: number };
    await saveConnection({
      userId,
      provider: "kalshi",
      accessToken: body.apiKey,
      accountName: `$${((data.balance ?? 0) / 100).toFixed(2)} balance`,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});
