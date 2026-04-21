# Deploying Bot Boss

This covers the backend, the web dashboard, and the iOS companion. The
architecture is intentionally boring: one Node service, one static web
bundle, one iOS app, one MySQL database.

## 0. Prerequisites on your end

You — not me — need to set these up, because they require accounts, DNS,
and decisions about domains / pricing.

- [ ] **Domains**: `botboss.app` (marketing + web), `api.botboss.app` (API).
- [ ] **Apple Developer** account (personal or organization).
- [ ] **MySQL 8+** database (planetscale / RDS / Fly Postgres-with-MySQL-proto / etc).
- [ ] **Fly.io** account for the backend (or any Docker host — see below).
- [ ] **Vercel** or **Cloudflare Pages** for the web bundle (optional; can be
      served by nginx from the same host as the API).
- [ ] **Stripe** account for billing.
- [ ] One OAuth app per provider you want to enable (Shopify, Etsy, Pinterest).

## 1. Provision the database

```bash
# Local dev:
docker compose up db
# Or remote — run the initial migrations against your MySQL 8+ instance:
mysql -h <host> -u <user> -p <db> < drizzle/0000_bot_boss_init.sql
mysql -h <host> -u <user> -p <db> < drizzle/0001_billing_webhooks.sql
```

For future schema changes, `pnpm db:push` (drizzle-kit) will generate +
apply migrations against `DATABASE_URL`.

## 2. Generate secrets

```bash
# 32-byte hex for the session JWT signer.
openssl rand -hex 32

# 32-byte hex for at-rest AES-256-GCM encryption of OAuth tokens.
openssl rand -hex 32
```

## 3. Configure Apple

### Sign in with Apple (iOS + web)

1. In Apple Developer Portal → Identifiers:
   - Create an **App ID** `com.botboss.BotBoss` with Sign in with Apple.
   - Create a **Services ID** `com.botboss.app.signin` with Sign in with Apple.
     - Primary App ID = `com.botboss.BotBoss`.
     - Return URL: `https://app.botboss.app/auth/apple/callback`
       (the web app posts the token to `/v1/auth/apple` after Apple redirects back).
2. In Xcode (`ios/`): select the BotBoss target → Signing & Capabilities →
   Team + automatic signing. Confirm "Sign in with Apple" capability is
   enabled (it's in `BotBoss.entitlements`).

### APNs push

1. Apple Developer Portal → Keys → **+ new key** with APNs enabled.
2. Download the `.p8` file (you can only download once — save it securely).
3. Note the **Key ID** (10 chars) and your **Team ID** (10 chars).
4. Set env on the backend:
   ```
   APPLE_TEAM_ID=XXXXXXXXXX
   APPLE_KEY_ID=YYYYYYYYYY
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
   <contents of the .p8>
   -----END PRIVATE KEY-----"
   APNS_ENVIRONMENT=production    # or "sandbox" for TestFlight-only
   ```

## 4. Create OAuth apps for each provider

### Shopify

1. [Partners dashboard](https://partners.shopify.com) → Apps → Create app (Custom or Public).
2. App URL: `https://app.botboss.app`
3. Allowed redirection URL(s): `https://api.botboss.app/v1/oauth/shopify/callback`
4. Copy Client ID / Client secret → env `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`.
5. Scopes are already set in `server/providers/shopify.ts`
   (`read_orders`, `read_products`, `read_inventory`, `read_customers`).
   Make sure your partner app declares the same scopes.
6. Webhook HMAC is verified against `SHOPIFY_CLIENT_SECRET`. No extra config —
   the backend auto-registers webhooks on connect at
   `https://api.botboss.app/v1/webhooks/shopify`.

### Etsy

1. [developers.etsy.com](https://www.etsy.com/developers/your-apps) → Create an app.
2. Grab the **keystring** and **shared secret** → env `ETSY_KEYSTRING` /
   `ETSY_SHARED_SECRET`.
3. Callback URL: `https://api.botboss.app/v1/oauth/etsy/callback`
4. Enable scopes matching `server/providers/etsy.ts`.

### Pinterest

1. [developers.pinterest.com](https://developers.pinterest.com/apps) → Create app.
2. Redirect URI: `https://api.botboss.app/v1/oauth/pinterest/callback`
3. Client id + secret → env `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET`.

### Kalshi

No OAuth dance; users paste their personal API key. Nothing for you to configure.

## 5. Configure Stripe

1. Stripe Dashboard → Products → create a product **Bot Boss Pro** with two
   prices:
   - Monthly: $19/mo recurring → note the `price_...` id.
   - Yearly: $149/yr recurring → note the `price_...` id.
2. Env:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PRICE_PRO_MONTHLY=price_xxx
   STRIPE_PRICE_PRO_YEARLY=price_yyy
   STRIPE_SUCCESS_URL=https://app.botboss.app/settings?billing=success
   STRIPE_CANCEL_URL=https://app.botboss.app/settings?billing=cancel
   ```
3. Stripe Dashboard → Developers → Webhooks → **+ endpoint**:
   - URL: `https://api.botboss.app/v1/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → env `STRIPE_WEBHOOK_SECRET`.

## 5b. Configure Apple In-App Purchases (iOS billing)

iOS billing **must** go through Apple IAP for digital goods (guideline 3.1.1).
StoreKit 2 is already wired in the app; you need to set up the products and
the App Store Server API credentials.

1. **App Store Connect → My Apps → BotBoss → Subscriptions:**
   - Create a subscription group named `Bot Boss Pro`.
   - Add two subscription products with these exact product IDs (they're
     hard-coded in `ios/BotBoss/Core/Subscriptions.swift`):
     - `com.botboss.pro.monthly`  ($19.99 / month)
     - `com.botboss.pro.yearly`   ($149.99 / year)

2. **App Store Connect → Users and Access → Integrations → In-App Purchase**
   → **+ new key**:
   - Download the `.p8`. Save the **Issuer ID** (UUID) and **Key ID** (10 chars).
   - Set env on the backend:
     ```
     APPSTORE_ISSUER_ID=...
     APPSTORE_KEY_ID=...
     APPSTORE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
     <contents of .p8>
     -----END PRIVATE KEY-----"
     APPSTORE_ENVIRONMENT=production   # or "sandbox" for TestFlight
     APPSTORE_BUNDLE_ID=com.botboss.BotBoss
     ```

3. **App Store Server Notifications V2:**
   - App Store Connect → your app → **App Information** → **App Store Server
     Notifications** → Production/Sandbox URL: `https://api.botboss.app/v1/webhooks/apple`
   - Version: V2.

4. The iOS paywall will automatically pick up the two products via
   `Product.products(for:)`. After any purchase, the app sends the
   transaction id to `POST /v1/billing/apple/verify` which consults the
   App Store Server API and updates the `subscriptions` table.

## 6. Deploy the backend

### On Fly.io (simplest)

```bash
fly launch --no-deploy                          # reads fly.toml
fly secrets set \
  DATABASE_URL="mysql://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  APPLE_CLIENT_ID="com.botboss.BotBoss" \
  APPLE_TEAM_ID="..." APPLE_KEY_ID="..." \
  APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)" \
  FORGE_API_URL="https://api.openai.com" \
  FORGE_API_KEY="sk-..." \
  PUBLIC_BASE_URL="https://api.botboss.app" \
  ALLOWED_ORIGINS="https://app.botboss.app" \
  SHOPIFY_CLIENT_ID="..." SHOPIFY_CLIENT_SECRET="..." \
  ETSY_KEYSTRING="..." ETSY_SHARED_SECRET="..." \
  PINTEREST_CLIENT_ID="..." PINTEREST_CLIENT_SECRET="..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_PRICE_PRO_MONTHLY="price_..." \
  STRIPE_PRICE_PRO_YEARLY="price_..."
fly deploy
fly certs add api.botboss.app
```

### On any Docker host

```bash
docker build -t botboss-server .
docker run -d --restart unless-stopped --name botboss \
  --env-file .env.production \
  -p 3000:3000 botboss-server
```

Put TLS-terminating nginx / Caddy / Cloudflare in front.

## 7. Deploy the web dashboard

```bash
cd web
pnpm install
pnpm build           # emits web/dist/
```

Upload `web/dist/` to Vercel, Cloudflare Pages, or any static host. Set
these build-time env vars (Vercel → Project Settings → Environment Variables):

```
VITE_API_BASE=https://api.botboss.app
VITE_APPLE_SERVICE_ID=com.botboss.app.signin
VITE_APPLE_REDIRECT_URI=https://app.botboss.app/auth/apple/callback
```

Or self-host with the included Dockerfile:

```bash
docker build -t botboss-web -f web/Dockerfile .
docker run -d --restart unless-stopped -p 80:80 botboss-web
```

## 8. Ship the iOS app

```bash
cd ios
brew install xcodegen
xcodegen generate
open BotBoss.xcodeproj
```

In Xcode:

1. Select a Development Team.
2. Update `BotBossAPIBaseURL` in `ios/BotBoss/Resources/Info.plist` to
   `https://api.botboss.app`.
3. For production builds, change `aps-environment` in `BotBoss.entitlements`
   from `development` to `production`.
4. Archive → Distribute → App Store Connect → TestFlight.

App Review notes:
- Sign in with Apple is the only auth method (compliant with 4.8).
- Privacy manifest is in place (`PrivacyInfo.xcprivacy`).
- No third-party payments inside the app (3.1.1).
- No private APIs.
- App icon needs to be added to `Assets.xcassets/AppIcon.appiconset` before
  submission.

## 9. Post-deploy smoke test

```bash
# Health
curl https://api.botboss.app/health

# Bot catalog (no auth needed)
curl -s https://api.botboss.app/v1/boss/catalog | jq

# After signing in on web, grab the session token from localStorage
# (key: botboss.session) and hit an authenticated endpoint:
curl -s -H "Authorization: Bearer $TOKEN" https://api.botboss.app/v1/boss/quota
```

## What I can't finish from here — your action items

| # | Item | Why it needs you |
|---|---|---|
| 1 | Apple Dev account + certs | Your identity, your team, your keys |
| 2 | APNs `.p8` key | Downloaded once to a trusted machine |
| 3 | OAuth partner apps (Shopify/Etsy/Pinterest) | Each requires a real business contact + a live domain |
| 4 | Stripe products + prices + webhook | Your bank account; your pricing decisions |
| 5 | App icon + launch screen polish | Design input |
| 6 | App Store Connect listing | Screenshots, description, privacy nutrition labels |
| 7 | DNS + TLS certs for botboss.app / api.botboss.app / app.botboss.app | Your domain |
| 8 | Apple IAP / StoreKit 2 for iOS subscriptions | See next-steps |

## Next-steps backlog (for me to pick up after this)

1. **Usage analytics on Activity** — tokens + cost per run, per bot, so
   you can watch unit economics live.
2. **Per-bot onboarding tours** — first-run tour per Money Bot explaining
   what to connect, what a typical week of prompts looks like.
3. **Integration tests** — real HTTP against the running server (full
   auth → bot-run → webhook → subscription flow).
4. **Localization** — App Store listing + in-app copy in a second language
   to open the EU market without extra work.
