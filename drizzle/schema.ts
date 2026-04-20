import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// OAuth connections — encrypted tokens per provider per user
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
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OAuthConnection = typeof oauthConnections.$inferSelect;

// CSRF state for OAuth flows
export const oauthState = mysqlTable("oauth_state", {
  id: int("id").autoincrement().primaryKey(),
  state: varchar("state", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  returnTo: text("returnTo"),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Installations — which agents each user has installed
export const installations = mysqlTable("installations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentSlug: varchar("agentSlug", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "uninstalled"]).default("active").notNull(),
  connectionId: int("connectionId"),
  customizations: json("customizations").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Installation = typeof installations.$inferSelect;

// Agent runs — action audit log
export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  installationId: int("installationId").notNull(),
  userId: int("userId").notNull(),
  agentSlug: varchar("agentSlug", { length: 128 }).notNull(),
  action: varchar("action", { length: 256 }).notNull(),
  status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
  inputSummary: text("inputSummary"),
  outputSummary: text("outputSummary"),
  tokensUsed: int("tokensUsed").default(0),
  durationMs: int("durationMs").default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentRun = typeof agentRuns.$inferSelect;

// In-app notifications
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["run_complete", "run_error", "new_bot", "system"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body"),
  agentSlug: varchar("agentSlug", { length: 128 }),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// Chat messages for the LLM assistant
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
