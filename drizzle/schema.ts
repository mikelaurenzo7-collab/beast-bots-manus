import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

/**
 * Users — Sign in with Apple is the only identity for the iOS app.
 * `appleSub` is Apple's stable `sub` claim from the identity token.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  appleSub: varchar("appleSub", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: varchar("name", { length: 256 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** OAuth connections for user-owned third-party tools (GitHub, Google, etc.). */
export const oauthConnections = mysqlTable("oauth_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  accessTokenCiphertext: text("accessTokenCiphertext"),
  refreshTokenCiphertext: text("refreshTokenCiphertext"),
  tokenIv: varchar("tokenIv", { length: 64 }),
  scopes: json("scopes").$type<string[]>(),
  expiresAt: timestamp("expiresAt"),
  accountId: varchar("accountId", { length: 256 }),
  accountName: varchar("accountName", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OAuthConnection = typeof oauthConnections.$inferSelect;

/** CSRF + PKCE state for initiating OAuth flows from web or iOS. */
export const oauthState = mysqlTable("oauth_state", {
  id: int("id").autoincrement().primaryKey(),
  state: varchar("state", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  codeVerifier: varchar("codeVerifier", { length: 256 }),
  shop: varchar("shop", { length: 256 }),
  returnTo: text("returnTo"),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** User-authored recipes: a saved prompt + tool allowlist, optionally scheduled. */
export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  prompt: text("prompt").notNull(),
  tools: json("tools").$type<string[]>().notNull(),
  triggerKind: mysqlEnum("triggerKind", ["manual", "schedule", "webhook"])
    .default("manual")
    .notNull(),
  triggerCron: varchar("triggerCron", { length: 128 }),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Recipe = typeof recipes.$inferSelect;

/** One run of a bot — either ad-hoc chat or a recipe execution. */
export const runs = mysqlTable("runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  botSlug: varchar("botSlug", { length: 64 }).default("boss").notNull(),
  recipeId: int("recipeId"),
  status: mysqlEnum("status", ["running", "success", "error"])
    .default("running")
    .notNull(),
  inputSummary: text("inputSummary"),
  outputSummary: text("outputSummary"),
  tokensUsed: int("tokensUsed").default(0),
  durationMs: int("durationMs").default(0),
  errorMessage: text("errorMessage"),
  toolCalls: json("toolCalls").$type<
    { name: string; input: unknown; ok: boolean; summary: string }[]
  >(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Run = typeof runs.$inferSelect;

/** Chat history — one thread per (user, bot). */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  botSlug: varchar("botSlug", { length: 64 }).default("boss").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  runId: int("runId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

/** Lightweight user notes, usable by the Boss via the `notes.*` tools. */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;

/** Stripe subscription state per user. Source of truth is Stripe — we
 *  mirror the minimal fields needed to gate Pro features and show "until". */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  plan: mysqlEnum("plan", ["free", "pro"]).default("free").notNull(),
  status: mysqlEnum("status", [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
  ])
    .default("active")
    .notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  /** Apple StoreKit: the originalTransactionId linking all renewals. */
  appleOriginalTransactionId: varchar("appleOriginalTransactionId", {
    length: 128,
  }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

/** Dedup + audit log for incoming provider webhooks. */
export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  externalId: varchar("externalId", { length: 128 }).notNull(),
  topic: varchar("topic", { length: 128 }).notNull(),
  userId: int("userId"),
  payload: json("payload"),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;

/** APNs device tokens for push notifications on run completion. */
export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceToken: varchar("deviceToken", { length: 256 }).notNull().unique(),
  bundleId: varchar("bundleId", { length: 128 }).notNull(),
  environment: mysqlEnum("environment", ["sandbox", "production"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
