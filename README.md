# Bot Boss

Specialist AI agents that run your store, creator channel, and trading desk.

One LLM runtime, many personas. Web app is the primary surface; iOS is the
push-notification companion.

> **Read `STRATEGY.md` first** for the product masterplan, shipping lineup,
> and web-vs-mobile rationale.

## Layout

```
web/          Vite + React + TanStack Query dashboard — primary UI.
ios/          SwiftUI app (iOS 17+) — push alerts + one-tap approvals.
server/       Express REST API — /v1/* routes, tool runtime, Drizzle ORM.
shared/       bots.ts catalog, used by web + iOS + server.
drizzle/      MySQL schema + migrations.
```

## Bots shipping in v1

| Bot | Revenue integration | Provider |
|---|---|---|
| Shopify Clerk | Store operator | Shopify Admin API |
| Etsy Shopkeeper | Marketplace seller | Etsy Open API v3 |
| Pinterest Pin Bot | Traffic → ecommerce | Pinterest REST v5 |
| Kalshi Trader | Event contracts | Kalshi Trade API v2 |
| Polymarket Scout | Market radar (read) | Polymarket Gamma API |
| Bot Boss | Generalist fallback | Built-ins only |

Each bot's system prompt and tool allowlist live in `shared/bots.ts`.

## Running locally

### Backend (required for both surfaces)

```bash
pnpm install
cp .env.example .env     # fill in DATABASE_URL, JWT_SECRET, APPLE_CLIENT_ID, FORGE_*
pnpm db:push
pnpm dev                 # http://localhost:3000
```

### Web

```bash
cd web
pnpm install
pnpm dev                 # http://localhost:5173, proxies /v1/* to :3000
```

### iOS

```bash
cd ios
brew install xcodegen    # one-time
xcodegen generate
open BotBoss.xcodeproj
```

Select a Development Team in Xcode, build & run on an iOS 17+ simulator.

## API surface

Base URL: `/v1`. All routes except `/v1/auth/*` require
`Authorization: Bearer <token>` where the token is a session JWT minted by
`POST /v1/auth/apple`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/auth/apple` | Exchange Sign-in-with-Apple identity token → session |
| GET  | `/v1/boss/catalog` | Bot catalog (slug, name, icon, required providers) |
| POST | `/v1/boss/run` | Run a bot on a message; body `{ botSlug, message, useHistory? }` |
| GET  | `/v1/boss/chat?botSlug=...` | Per-bot chat history |
| GET  | `/v1/connections` | User's OAuth connections |
| POST | `/v1/connections` | Upsert a connection (encrypted at rest) |
| DELETE | `/v1/connections/:provider` | Disconnect |
| GET/POST/PATCH/DELETE | `/v1/recipes` | Saved prompt+tool presets |
| GET  | `/v1/runs` | Run history |
| GET/POST | `/v1/notes` | Notes (used by bots and browseable by users) |
| POST | `/v1/devices` | Register APNs device token |

## Environment

See `.env.example` for required backend env. Web and iOS need additional
Apple Sign-In config — see `STRATEGY.md` § Platform call.

## Status

Not production-ready yet. What works:
- REST API with per-bot routing, auth, encrypted connections, Drizzle schema.
- Web dashboard skeleton (bots catalog, chat, recipes, history, connections).
- iOS skeleton (Sign in with Apple, bot catalog, per-bot chat, push registration).
- Tool integrations for all 5 shipping bots (Shopify, Etsy, Pinterest, Kalshi, Polymarket).

What's next (in order):
1. OAuth callback routes for each provider (PKCE + CSRF state).
2. End-to-end demo: Shopify Clerk → iOS push → one-tap approval.
3. Billing (Stripe on web, Apple IAP on iOS).
4. TestFlight beta.
