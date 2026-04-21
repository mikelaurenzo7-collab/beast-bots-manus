# Bot Boss

One agent. Plain-text recipes. Yours.

Bot Boss is a native iOS app (SwiftUI, iOS 17+) backed by a small Node REST
server. The agent is a single LLM loop with a built-in tool registry — no
catalog of "80 agents," no drag-and-drop workflow composer. Users teach it
what to do through saved recipes (prompt + tool allowlist, optionally
scheduled).

## Layout

```
ios/          — SwiftUI app. Generate Xcode project with `xcodegen generate`.
server/       — Express + Drizzle REST API.
shared/       — Shared TS config (single-Boss definition).
drizzle/      — MySQL schema. Run `pnpm db:push` to sync.
```

## Backend

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, APPLE_CLIENT_ID, FORGE_*
pnpm db:push
pnpm dev
```

Required env:

| Variable          | Purpose                                                 |
|-------------------|---------------------------------------------------------|
| `DATABASE_URL`    | MySQL connection string                                 |
| `JWT_SECRET`      | 32+ char HS256 secret for session bearer tokens         |
| `ENCRYPTION_KEY`  | 32-byte hex for AES-256-GCM of stored OAuth tokens      |
| `APPLE_CLIENT_ID` | iOS app Bundle ID (audience on SIWA identity tokens)    |
| `FORGE_API_URL`   | OpenAI-compatible LLM endpoint                          |
| `FORGE_API_KEY`   | LLM API key                                             |

## iOS app

```bash
cd ios
brew install xcodegen      # one time
xcodegen generate
open BotBoss.xcodeproj
```

Then in Xcode: select a Development Team, build & run on an iOS 17+
simulator or device.

### App Store compliance baked in

- **Sign in with Apple** is the only login method (guideline 4.8 is moot).
- **Privacy manifest** (`PrivacyInfo.xcprivacy`) declares the one Required
  Reasons API we touch (UserDefaults, CA92.1) and lists collected data types.
- **No tracking** — `NSPrivacyTracking = false`, no third-party analytics.
- **No external payment links** — there is no paid/subscription UI yet, so
  guideline 3.1.1 doesn't apply.
- **ATS enforced** — `NSAllowsArbitraryLoads = false`.
- **Background modes**: only `remote-notification` for APNs.

### API endpoints

| Method | Path                          | Purpose                     |
|--------|-------------------------------|-----------------------------|
| POST   | `/v1/auth/apple`              | Exchange SIWA token → session |
| POST   | `/v1/boss/run`                | Run the Boss on a message     |
| GET    | `/v1/boss/chat`               | Chat history                  |
| GET    | `/v1/connections`             | List OAuth connections        |
| POST   | `/v1/connections`             | Upsert a connection           |
| DELETE | `/v1/connections/:provider`   | Disconnect                    |
| GET    | `/v1/recipes`                 | List recipes                  |
| POST   | `/v1/recipes`                 | Create recipe                 |
| PATCH  | `/v1/recipes/:id`             | Update recipe                 |
| DELETE | `/v1/recipes/:id`             | Archive recipe                |
| GET    | `/v1/runs`                    | Run history                   |
| GET    | `/v1/notes`                   | List notes                    |
| POST   | `/v1/notes`                   | Create note                   |
| POST   | `/v1/devices`                 | Register APNs device token    |

All `/v1/*` routes except `/v1/auth/*` require `Authorization: Bearer <token>`.
