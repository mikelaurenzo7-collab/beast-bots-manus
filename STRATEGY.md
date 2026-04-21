# Bot Boss — Masterplan

## One-liner

**Bot Boss ships specialist AI agents that earn money for their owner.** Each
bot is tightly scoped to one revenue surface (Shopify store, Etsy shop, Kalshi
account, Pinterest channel). Users don't prompt a generic chatbot; they hire a
specialist.

## The thesis

1. **Generic "AI assistants" don't print money.** They save minutes, not dollars.
2. **Specialists do.** A bot that prevents a stockout, renews an expiring Etsy
   listing, or closes a Kalshi position at the right moment pays for itself
   the week you install it.
3. **Distribution is the moat.** Not the model. We win by being the first
   place a Shopify seller or Kalshi trader goes to get an operator-grade
   agent for their craft.

## Shipping lineup (v1)

| Bot | Who it's for | Revenue it produces or saves |
|---|---|---|
| **Shopify Clerk** | Shopify store owners | Catches stockouts, flags hot SKUs, drafts promos |
| **Etsy Shopkeeper** | Etsy sellers | Prevents lapsed listings, protects review avg |
| **Pinterest Pin Bot** | Ecommerce + creators | Evergreen pin traffic to Shopify/Etsy/affiliate |
| **Kalshi Trader** | Event-contract traders | Research + confirmation-gated execution |
| **Polymarket Scout** | Market watchers | Read-only radar that feeds the Kalshi Trader |
| **Bot Boss** | Everyone | Generalist fallback that hands off to specialists |

Each bot has its own system prompt, tool allowlist, and required OAuth
connections. One runtime, many personas.

## Shipping after v1 (coming soon)

Ordered by expected MRR per installed user:

1. **Stripe Revenue** — churn rescue + dunning; SaaS operators; pays for itself.
2. **Amazon SP Clerk** — inventory + PPC; biggest margin lever for Amazon sellers.
3. **Alpaca Equities** — commission-free stocks with risk rails.
4. **Coinbase Crypto** — DCA + tax-aware rebalancing.
5. **YouTube Manager** — comment triage + next-video prompts.
6. **TikTok Analyst** — remake-what-worked loop.
7. **Substack Writer** — newsletter drafting + paid-sub churn rescue.
8. **Gumroad Seller** — launch coordination + affiliate recruiting.
9. **Airbnb Host** — dynamic pricing + guest reply drafts.

## Connectors — only what serves a Money Bot

We deliberately reject "random" integrations. Every connector must serve a
shipping bot; if the bot isn't in v1, the connector waits.

| Connector | Serves |
|---|---|
| `shopify` | Shopify Clerk |
| `etsy` | Etsy Shopkeeper |
| `pinterest` | Pinterest Pin Bot |
| `kalshi` | Kalshi Trader |
| `sec` (public) | Kalshi Trader research |
| `congress` (public) | Kalshi Trader research |
| `polymarket` (public) | Polymarket Scout, Kalshi Trader |
| `web.search` / `web.fetch` / `time` / `notes` | Every bot |

Dropped from earlier drafts because no shipping bot needs them:
Manifold Markets, NOAA weather, OpenFDA, OpenSky, Patent search, CourtListener,
FEC. They come back when a bot that needs them comes back.

## Platform call: web primary, iOS companion

**Web is the primary surface.** The target users do revenue work at a laptop:
multi-tab, wide screens, long sessions. Shopify admins open the app next to
Shopify Admin. Kalshi traders have TradingView in another tab. Creators edit
videos on a desktop and publish from a laptop. The workflow is *dense*.

**iOS is the companion.** Mobile's job:
- Push alerts the moment something matters (stockout, order, Kalshi market close).
- One-tap approve / deny for trades and refunds the bot proposed.
- Quick-look dashboards when you're away from the desk.

**Why keep iOS at all?** It's our best moat:
- APNs push + Sign in with Apple out of the box.
- Lock-screen Live Activities for running trades.
- HealthKit/EventKit/Reminders as a lever for future consumer bots.
- App Store distribution is cheap reach.

We do **not** keep iOS as the only surface. That was a mistake we corrected.

## Architecture

```
web/          — Vite + React + TanStack Query SPA (primary).
ios/          — SwiftUI app (companion, push notifications + approvals).
server/       — Express REST API (one-and-only backend).
shared/       — bots.ts catalog shared by web + iOS + server.
drizzle/      — MySQL schema.
```

Both front-ends hit the same `/v1/*` REST API. No duplicated business logic.
One LLM loop (`server/runtime/execute.ts`) drives every bot; the bot catalog
supplies the system prompt and tool allowlist.

## Monetization

- **Free**: 50 runs/mo, 3 recipes, built-in tools only (Bot Boss generalist + Polymarket Scout read-only).
- **Pro — $19/mo or $149/yr**: 2,500 runs/mo, unlimited recipes, all OAuth
  connections (Shopify/Etsy/Pinterest/Kalshi), scheduled recipes, iOS push.
- **Power — $49/mo**: 10k runs, team seats, webhook triggers, priority models.

Billing on web = Stripe. Billing on iOS = Apple IAP (guideline 3.1.1). Same
account, one subscription state in the DB; the price is higher on iOS IAP to
cover Apple's 15–30% tax, and the web page makes the web price visible.

Unit economics at $19/mo Pro avg ~400 runs/mo:
- LLM cost: ~$2 (gemini-flash blended)
- Payment processing: ~$0.80
- **Net margin: ~85%** before Apple tax on iOS signups.

## Defensibility — the three moats

1. **Specialist depth.** Anyone can wrap GPT. A Shopify Clerk that actually
   prevents stockouts needs the Shopify Admin API wired + a stockout-detection
   recipe + a notification path + a UI pattern for confirming marketing drafts.
   Each bot is ~2 weeks of focused work. Compounds.

2. **iOS companion + push.** A trader who gets the "Kalshi FED-24DEC close in
   12min, your position is up 23%" push and taps Approve-Sell once will never
   go back to a web-only tool. This requires native iOS.

3. **Recipe graph.** The saved prompt + tool allowlist + schedule each user
   builds is portable leverage. Over time, public recipes become a shared
   catalog ("the 10 most-installed Shopify recipes"), a network-effect layer
   nobody else has because nobody else has the installed base.

## The next 90 days

1. **Wire OAuth callbacks** for shopify, etsy, pinterest, kalshi. The token
   storage (`server/db.ts`) is ready; we need `/v1/oauth/:provider/start` and
   `/callback` routes with PKCE + CSRF state.
2. **Ship a working Shopify Clerk** end-to-end — real store, real stockout
   alert via push to iOS. That's our demo.
3. **TestFlight beta** of the iOS companion. Push notifications are the wow.
4. **$3k MRR from 150 Shopify/Etsy Pro subs.** Enough signal to hire the
   first engineer.
5. **Ship Stripe Revenue + Alpaca Equities** as the second and third bots.
   These two alone unlock SaaS operators and disciplined retail traders.

## What could kill this

- **App Review** rejecting iOS as "a chatbot" — mitigated by positioning each
  bot as a dedicated utility with clear non-AI value (stockout alerts are
  useful even if the LLM part is switched off).
- **OAuth partner risk** — Shopify or Kalshi deciding they don't like agents.
  Mitigated by bring-your-own-token for private apps; a single partner
  revocation shouldn't break the product.
- **LLM cost blowouts** — hard per-user daily budgets + `maxTurns` cap + tool
  call ceilings prevent runaway loops.
- **Trust on trading bots** — every money-moving action requires a user
  confirmation. We'll never auto-execute without consent; the bot proposes,
  the user presses the button.

## North-star metric

**Weekly runs per paying user.** Not MAU. If a Shopify seller runs their
Clerk 3x/day, we're winning. If they sign up and forget, we're not.
