/**
 * Environment configuration for the Bot Boss backend.
 *
 * Required in production:
 *   - DATABASE_URL         MySQL connection string
 *   - JWT_SECRET           HS256 signing secret for session bearer tokens
 *   - ENCRYPTION_KEY       32-byte hex for AES-256-GCM at-rest encryption
 *   - APPLE_CLIENT_ID      The app's Bundle ID (audience on SIWA tokens)
 *   - FORGE_API_URL        LLM endpoint (OpenAI-compatible)
 *   - FORGE_API_KEY        LLM API key
 *
 * Optional:
 *   - APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY   for APNs push
 *   - APNS_BUNDLE_ID       iOS bundle id (defaults to APPLE_CLIENT_ID)
 *   - APNS_ENVIRONMENT     "sandbox" | "production"
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

  port: parseInt(process.env.PORT ?? "3000", 10),
};
