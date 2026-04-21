/**
 * Environment configuration for the Bot Boss backend.
 *
 * Required in production:
 *   - DATABASE_URL         MySQL connection string
 *   - JWT_SECRET           HS256 signing secret for session bearer tokens (>= 32 chars)
 *   - ENCRYPTION_KEY       32-byte hex for AES-256-GCM at-rest encryption
 *   - APPLE_CLIENT_ID      The app's Bundle ID (audience on SIWA tokens)
 *   - FORGE_API_URL        LLM endpoint (OpenAI-compatible)
 *   - FORGE_API_KEY        LLM API key
 *   - PUBLIC_BASE_URL      Publicly-reachable URL of the API (for OAuth redirects)
 *
 * Optional:
 *   - APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY   for APNs push
 *   - APNS_BUNDLE_ID       iOS bundle id (defaults to APPLE_CLIENT_ID)
 *   - APNS_ENVIRONMENT     "sandbox" | "production"
 *   - ALLOWED_ORIGINS      CSV of allowed CORS origins for the web app
 *   - DAILY_RUN_QUOTA_FREE / DAILY_RUN_QUOTA_PRO
 *
 * Per-provider OAuth client credentials (optional until you ship that bot):
 *   - SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET
 *   - ETSY_KEYSTRING / ETSY_SHARED_SECRET
 *   - PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET
 */
export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  encryptionKey: process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "",

  appleClientId: process.env.APPLE_CLIENT_ID ?? "",
  appleTeamId: process.env.APPLE_TEAM_ID ?? "",
  appleKeyId: process.env.APPLE_KEY_ID ?? "",
  applePrivateKey: process.env.APPLE_PRIVATE_KEY ?? "",

  apnsBundleId: process.env.APNS_BUNDLE_ID ?? process.env.APPLE_CLIENT_ID ?? "",
  apnsEnvironment: (process.env.APNS_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "production",

  forgeApiUrl: process.env.FORGE_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",

  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
  allowedOrigins:
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],

  port: parseInt(process.env.PORT ?? "3000", 10),

  // OAuth clients
  shopifyClientId: process.env.SHOPIFY_CLIENT_ID ?? "",
  shopifyClientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
  etsyKeystring: process.env.ETSY_KEYSTRING ?? "",
  etsySharedSecret: process.env.ETSY_SHARED_SECRET ?? "",
  pinterestClientId: process.env.PINTEREST_CLIENT_ID ?? "",
  pinterestClientSecret: process.env.PINTEREST_CLIENT_SECRET ?? "",

  // Run quotas. Enforced in server/api/boss.ts.
  dailyRunQuotaFree: parseInt(process.env.DAILY_RUN_QUOTA_FREE ?? "50", 10),
  dailyRunQuotaPro: parseInt(process.env.DAILY_RUN_QUOTA_PRO ?? "2500", 10),

  // Stripe billing (web subscriptions).
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",

  // Where Stripe should bounce the user back after checkout/portal.
  stripeSuccessUrl:
    process.env.STRIPE_SUCCESS_URL ?? "https://app.botboss.app/settings?billing=success",
  stripeCancelUrl:
    process.env.STRIPE_CANCEL_URL ?? "https://app.botboss.app/settings?billing=cancel",
};
