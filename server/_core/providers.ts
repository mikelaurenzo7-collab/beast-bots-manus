/**
 * OAuth 2.0 provider registry.
 *
 * Each entry describes everything the server needs to complete the authorization
 * code flow for a third-party provider: authorize endpoint, token exchange
 * endpoint, default scopes, and an optional user-info fetch so we can store a
 * human-readable `accountName` alongside the encrypted token.
 *
 * Client credentials are read from environment variables at runtime so that a
 * missing provider simply disables that integration instead of crashing boot.
 * The env-var naming convention is `{PROVIDER}_CLIENT_ID` / `{PROVIDER}_CLIENT_SECRET`.
 */

export type ProviderConfig = {
  /** Stable id matching `oauth_connections.provider` and `Beast.oauthProvider`. */
  id: string;
  /** Display name shown in UI and error messages. */
  label: string;
  /** Authorization endpoint (user is redirected here to grant consent). */
  authorizeUrl: string;
  /** Token exchange endpoint (server posts code + secret here for tokens). */
  tokenUrl: string;
  /** Default OAuth scopes requested if the beast doesn't override them. */
  defaultScopes: string[];
  /**
   * Scope delimiter used in the `scope` query/body param. Most providers use a
   * space; Notion uses commas; GitHub supports both.
   */
  scopeDelimiter?: string;
  /** Env var holding the client id. Defaults to `${ID}_CLIENT_ID`. */
  clientIdEnv?: string;
  /** Env var holding the client secret. Defaults to `${ID}_CLIENT_SECRET`. */
  clientSecretEnv?: string;
  /** Optional fixed audience (Auth0/Salesforce style). */
  audience?: string;
  /** Optional extra query params to append to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;
  /** Optional extra body params to append to the token exchange. */
  extraTokenParams?: Record<string, string>;
  /** Auth method for the token endpoint. Default "basic" sends client creds in the Authorization header. */
  tokenAuthMethod?: "basic" | "body";
  /**
   * Optional user-info fetcher. Given a decrypted access token, returns
   * `{ accountId, accountName }` to persist for this connection row.
   */
  getAccountInfo?: (accessToken: string) => Promise<{ accountId?: string; accountName?: string }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

const PROVIDERS: Record<string, ProviderConfig> = {
  github: {
    id: "github",
    label: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    defaultScopes: ["repo", "read:user", "user:email"],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const user = await fetchJson<{ id: number; login: string; name?: string }>(
        "https://api.github.com/user",
        {
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${accessToken}`,
            "user-agent": "beast-bots",
          },
        }
      );
      return { accountId: String(user.id), accountName: user.name || user.login };
    },
  },

  google: {
    id: "google",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    defaultScopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive.file",
    ],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    extraAuthorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    async getAccountInfo(accessToken) {
      const me = await fetchJson<{ sub: string; email?: string; name?: string }>(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { authorization: `Bearer ${accessToken}` } }
      );
      return { accountId: me.sub, accountName: me.name || me.email };
    },
  },

  slack: {
    id: "slack",
    label: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    defaultScopes: ["channels:read", "chat:write", "users:read", "groups:read"],
    scopeDelimiter: ",",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const res = await fetchJson<{ ok: boolean; team?: { id: string; name: string }; user?: { name?: string } }>(
        "https://slack.com/api/auth.test",
        { method: "POST", headers: { authorization: `Bearer ${accessToken}` } }
      );
      return {
        accountId: res.team?.id,
        accountName: res.team?.name ? `${res.team.name}${res.user?.name ? ` (${res.user.name})` : ""}` : res.user?.name,
      };
    },
  },

  notion: {
    id: "notion",
    label: "Notion",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    defaultScopes: [],
    scopeDelimiter: ",",
    extraAuthorizeParams: { owner: "user" },
    tokenAuthMethod: "basic",
    async getAccountInfo(accessToken) {
      const me = await fetchJson<{ bot?: { owner?: { user?: { name?: string } }; workspace_name?: string } }>(
        "https://api.notion.com/v1/users/me",
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
            "notion-version": "2022-06-28",
          },
        }
      );
      return { accountName: me.bot?.workspace_name || me.bot?.owner?.user?.name };
    },
  },

  linear: {
    id: "linear",
    label: "Linear",
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    defaultScopes: ["read", "write", "issues:create"],
    scopeDelimiter: ",",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const res = await fetchJson<{ data?: { viewer?: { id: string; name: string; email: string } } }>(
        "https://api.linear.app/graphql",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ query: "{ viewer { id name email } }" }),
        }
      );
      const v = res.data?.viewer;
      return { accountId: v?.id, accountName: v?.name || v?.email };
    },
  },

  discord: {
    id: "discord",
    label: "Discord",
    authorizeUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    defaultScopes: ["identify", "guilds", "bot"],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const user = await fetchJson<{ id: string; username: string; global_name?: string }>(
        "https://discord.com/api/users/@me",
        { headers: { authorization: `Bearer ${accessToken}` } }
      );
      return { accountId: user.id, accountName: user.global_name || user.username };
    },
  },

  figma: {
    id: "figma",
    label: "Figma",
    authorizeUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://api.figma.com/v1/oauth/token",
    defaultScopes: ["file_read"],
    scopeDelimiter: ",",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const user = await fetchJson<{ id: string; handle: string; email: string }>(
        "https://api.figma.com/v1/me",
        { headers: { authorization: `Bearer ${accessToken}` } }
      );
      return { accountId: user.id, accountName: user.handle || user.email };
    },
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    defaultScopes: ["openid", "profile", "email", "w_member_social"],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const me = await fetchJson<{ sub: string; name?: string; email?: string }>(
        "https://api.linkedin.com/v2/userinfo",
        { headers: { authorization: `Bearer ${accessToken}` } }
      );
      return { accountId: me.sub, accountName: me.name || me.email };
    },
  },

  microsoft: {
    id: "microsoft",
    label: "Microsoft",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    defaultScopes: ["openid", "email", "profile", "offline_access", "Mail.ReadWrite", "Calendars.ReadWrite"],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const me = await fetchJson<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }>(
        "https://graph.microsoft.com/v1.0/me",
        { headers: { authorization: `Bearer ${accessToken}` } }
      );
      return { accountId: me.id, accountName: me.displayName || me.mail || me.userPrincipalName };
    },
  },

  hubspot: {
    id: "hubspot",
    label: "HubSpot",
    authorizeUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    defaultScopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read"],
    scopeDelimiter: " ",
    tokenAuthMethod: "body",
    async getAccountInfo(accessToken) {
      const info = await fetchJson<{ hub_id: number; hub_domain: string; user: string }>(
        `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
        {}
      );
      return { accountId: String(info.hub_id), accountName: info.hub_domain || info.user };
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDERS[id];
}

export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

export type ProviderCredentials = { clientId: string; clientSecret: string };

/**
 * Resolve client credentials for a provider from environment variables.
 * Returns null when credentials are not configured — callers should treat this
 * as "provider disabled" rather than a crash.
 */
export function getProviderCredentials(provider: ProviderConfig): ProviderCredentials | null {
  const idEnv = provider.clientIdEnv ?? `${provider.id.toUpperCase()}_CLIENT_ID`;
  const secretEnv = provider.clientSecretEnv ?? `${provider.id.toUpperCase()}_CLIENT_SECRET`;
  const clientId = process.env[idEnv];
  const clientSecret = process.env[secretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Providers whose credentials are currently present in env. */
export function listEnabledProviderIds(): string[] {
  return Object.values(PROVIDERS)
    .filter((p) => getProviderCredentials(p) !== null)
    .map((p) => p.id);
}
