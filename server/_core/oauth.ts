import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { encryptToken } from "./crypto";
import { getSessionCookieOptions } from "./cookies";
import {
  getProviderConfig,
  getProviderCredentials,
  listProviders,
  type ProviderConfig,
} from "./providers";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function baseUrl(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function callbackUrl(req: Request, providerId: string): string {
  return `${baseUrl(req)}/api/connect/${providerId}/callback`;
}

// ─── Third-party OAuth — authorization code flow ─────────────────────────────

async function handleConnectStart(req: Request, res: Response) {
  const providerId = req.params.provider;
  const provider = getProviderConfig(providerId);
  if (!provider) {
    res.status(404).send("Unknown provider");
    return;
  }

  // Authenticate the user initiating the connect flow — we need their userId.
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).redirect(`/?login=required&connect=${encodeURIComponent(providerId)}`);
    return;
  }

  const creds = getProviderCredentials(provider);
  if (!creds) {
    // Gracefully land the user on Settings with an error flag instead of 500.
    res.redirect(
      `/settings?connect_error=${encodeURIComponent(providerId)}&reason=${encodeURIComponent(
        `${provider.label} is not configured on this deployment.`
      )}`
    );
    return;
  }

  // 32-byte, URL-safe, unguessable state.
  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const returnTo = getQueryParam(req, "return_to") || "/settings";

  await db.createOAuthState({
    state,
    userId: user.id,
    providerId,
    returnTo,
    expiresAt,
  });

  const scope = (provider.defaultScopes.length > 0
    ? provider.defaultScopes.join(provider.scopeDelimiter ?? " ")
    : "");

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: callbackUrl(req, providerId),
    response_type: "code",
    state,
  });
  if (scope) params.set("scope", scope);
  if (provider.audience) params.set("audience", provider.audience);
  for (const [k, v] of Object.entries(provider.extraAuthorizeParams ?? {})) {
    params.set(k, v);
  }

  res.redirect(302, `${provider.authorizeUrl}?${params.toString()}`);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string | string[];
  token_type?: string;
  // Notion-style
  workspace_name?: string;
  workspace_id?: string;
  bot_id?: string;
  // Slack v2
  team?: { id: string; name: string };
  authed_user?: { id: string };
  error?: string;
  error_description?: string;
};

async function exchangeCode(
  provider: ProviderConfig,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  for (const [k, v] of Object.entries(provider.extraTokenParams ?? {})) body.set(k, v);

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": "beast-bots",
  };

  if (provider.tokenAuthMethod === "basic") {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  const res = await fetch(provider.tokenUrl, { method: "POST", headers, body });
  const text = await res.text();
  let json: TokenResponse;
  try {
    json = JSON.parse(text) as TokenResponse;
  } catch {
    // GitHub returns form-urlencoded when `accept` isn't honored — handle both.
    const params = new URLSearchParams(text);
    json = {
      access_token: params.get("access_token") ?? undefined,
      refresh_token: params.get("refresh_token") ?? undefined,
      scope: params.get("scope") ?? undefined,
      token_type: params.get("token_type") ?? undefined,
      error: params.get("error") ?? undefined,
      error_description: params.get("error_description") ?? undefined,
    };
  }

  if (json.error || !json.access_token) {
    throw new Error(
      `token exchange failed: ${json.error ?? "no access_token"}${
        json.error_description ? ` — ${json.error_description}` : ""
      }`
    );
  }
  return json;
}

async function handleConnectCallback(req: Request, res: Response) {
  const providerId = req.params.provider;
  const provider = getProviderConfig(providerId);
  if (!provider) {
    res.status(404).send("Unknown provider");
    return;
  }

  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  const oauthError = getQueryParam(req, "error");

  if (oauthError) {
    res.redirect(
      `/settings?connect_error=${encodeURIComponent(providerId)}&reason=${encodeURIComponent(oauthError)}`
    );
    return;
  }
  if (!code || !state) {
    res.status(400).send("code and state are required");
    return;
  }

  const stateRow = await db.consumeOAuthState(state);
  if (!stateRow || stateRow.providerId !== providerId) {
    res.redirect(
      `/settings?connect_error=${encodeURIComponent(providerId)}&reason=${encodeURIComponent(
        "state expired or invalid — please try again"
      )}`
    );
    return;
  }

  const creds = getProviderCredentials(provider);
  if (!creds) {
    res.redirect(`/settings?connect_error=${encodeURIComponent(providerId)}&reason=not_configured`);
    return;
  }

  try {
    const tokens = await exchangeCode(provider, code, callbackUrl(req, providerId), creds.clientId, creds.clientSecret);

    // Best-effort account name (non-fatal if it fails).
    let accountId: string | undefined;
    let accountName: string | undefined;
    if (tokens.team?.name) accountName = tokens.team.name;
    if (tokens.team?.id) accountId = tokens.team.id;
    if (tokens.workspace_name) accountName = tokens.workspace_name;
    if (tokens.workspace_id) accountId = tokens.workspace_id;
    if (!accountName && provider.getAccountInfo) {
      try {
        const info = await provider.getAccountInfo(tokens.access_token!);
        if (info.accountId) accountId = info.accountId;
        if (info.accountName) accountName = info.accountName;
      } catch (err) {
        console.warn(`[OAuth] getAccountInfo(${providerId}) failed:`, err);
      }
    }

    const scopes = Array.isArray(tokens.scope)
      ? tokens.scope
      : typeof tokens.scope === "string"
        ? tokens.scope.split(/[\s,]+/).filter(Boolean)
        : provider.defaultScopes;

    const { ciphertext: accessCt, iv } = encryptToken(tokens.access_token!);
    // Re-use the same IV bucket label for both secrets. Encrypt refresh with a
    // fresh IV so tags are distinct; we only store one IV so we pack refresh's
    // own IV into the ciphertext string.
    let refreshCiphertext: string | undefined;
    if (tokens.refresh_token) {
      const r = encryptToken(tokens.refresh_token);
      refreshCiphertext = `${r.iv}|${r.ciphertext}`;
    }

    await db.upsertOAuthConnection({
      userId: stateRow.userId,
      provider: providerId,
      accessTokenCiphertext: accessCt,
      refreshTokenCiphertext: refreshCiphertext,
      tokenIv: iv,
      scopes,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      accountId,
      accountName,
      metadata: {
        tokenType: tokens.token_type,
        authedUserId: tokens.authed_user?.id,
        botId: tokens.bot_id,
      },
    });

    const dest = stateRow.returnTo && stateRow.returnTo.startsWith("/") ? stateRow.returnTo : "/settings";
    const sep = dest.includes("?") ? "&" : "?";
    res.redirect(`${dest}${sep}connected=${encodeURIComponent(providerId)}`);
  } catch (err) {
    console.error(`[OAuth] Callback for ${providerId} failed:`, err);
    res.redirect(
      `/settings?connect_error=${encodeURIComponent(providerId)}&reason=${encodeURIComponent(
        err instanceof Error ? err.message : String(err)
      )}`
    );
  }
}

// ─── Manus session cookie callback (unchanged) ───────────────────────────────

async function handleManusSessionCallback(req: Request, res: Response) {
  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");

  if (!code || !state) {
    res.status(400).json({ error: "code and state are required" });
    return;
  }

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      res.status(400).json({ error: "openId missing from user info" });
      return;
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.redirect(302, "/");
  } catch (error) {
    console.error("[OAuth] Manus callback failed", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
}

export function registerOAuthRoutes(app: Express) {
  // Manus session login (unchanged).
  app.get("/api/oauth/callback", handleManusSessionCallback);

  // Third-party provider connection flow.
  app.get("/api/connect/:provider/start", handleConnectStart);
  app.get("/api/connect/:provider/callback", handleConnectCallback);

  // Public introspection endpoint — lets the client show which providers are
  // actually configured on this deployment (vs just listed).
  app.get("/api/connect/providers", (_req: Request, res: Response) => {
    const providers = listProviders().map((p) => ({
      id: p.id,
      label: p.label,
      enabled: getProviderCredentials(p) !== null,
      scopes: p.defaultScopes,
    }));
    res.json({ providers });
  });
}
