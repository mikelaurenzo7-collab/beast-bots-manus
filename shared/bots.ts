/**
 * Money Bots catalog.
 *
 * Each bot is a specialist persona wired to one revenue-generating
 * integration. One LLM runtime, many personas — the bot selects the
 * system prompt, the allowed tools, and the required OAuth providers.
 *
 * Principle: a bot ships in v1 only if we have real tool coverage for it.
 * Coming-soon bots are listed in COMING_SOON so the UI can preview without
 * pretending they work.
 */

export type BotSlug =
  | "boss"
  | "shopify-clerk"
  | "etsy-shopkeeper"
  | "pinterest-pin-bot"
  | "kalshi-trader"
  | "polymarket-scout";

export type BotCategory = "ecommerce" | "creator" | "trading" | "general";

export type Bot = {
  slug: BotSlug;
  name: string;
  tagline: string;
  category: BotCategory;
  icon: string; // SF Symbols name
  systemPrompt: string;
  tools: string[];
  requiredProviders: string[]; // empty → usable without any connection
  /** Human-facing blurb about what this bot can actually earn/save. */
  revenueProposition: string;
};

const COMMON_SAFETY = `
Safety rules (never break):
- For trades, orders, or anything that spends money: propose the exact action and WAIT for explicit user confirmation before calling the tool. One confirmation per action.
- Never include API secrets or auth tokens in your replies.
- If a required connection is missing, tell the user which one and how to connect it. Don't pretend.
- Be concise. Numbers first, then the one action the user should take.
`.trim();

const BOSS_SYSTEM_PROMPT = `You are Bot Boss — the generalist. Be direct, use tools when they save the user a step, and finish with a one-line summary of what happened or what's next.

${COMMON_SAFETY}`;

export const BOSS: Bot = {
  slug: "boss",
  name: "Bot Boss",
  tagline: "Your generalist",
  category: "general",
  icon: "bolt.fill",
  systemPrompt: BOSS_SYSTEM_PROMPT,
  tools: [
    "web.search",
    "web.fetch",
    "time.now",
    "notes.save",
    "notes.list",
    "notes.get",
    "math.calculate",
    "report.table",
  ],
  requiredProviders: [],
  revenueProposition: "Ambient helper. Ask it anything; it hands off to a specialist when needed.",
};

export const BOTS: Bot[] = [
  BOSS,

  // ─── Ecommerce ──────────────────────────────────────────────────────────
  {
    slug: "shopify-clerk",
    name: "Shopify Clerk",
    tagline: "Runs your storefront",
    category: "ecommerce",
    icon: "bag.fill",
    systemPrompt: `You are the Shopify Clerk. You run the user's Shopify store.

Priorities (in order):
1. Catch stockouts before they cost a sale — flag low-stock SKUs proactively.
2. Summarize today's revenue and the one outlier worth knowing about.
3. Draft promo copy / product descriptions on request, in the user's voice.

Never create orders, issue refunds, or edit inventory without explicit confirmation.

${COMMON_SAFETY}`,
    tools: [
      "shopify.recent_orders",
      "shopify.sales_summary",
      "shopify.low_stock",
      "shopify.abandoned_checkouts",
      "shopify.get_customer",
      "shopify.create_discount_code",
      "shopify.create_fulfillment",
      "shopify.list_products",
      "notes.save",
      "notes.list",
      "web.search",
      "time.now",
      "math.calculate",
      "report.table",
    ],
    requiredProviders: ["shopify"],
    revenueProposition:
      "Catches low stock, recovers abandoned carts, creates promos, fulfills orders. Replaces a VA / ops hire.",
  },
  {
    slug: "etsy-shopkeeper",
    name: "Etsy Shopkeeper",
    tagline: "Listings, reviews, renewals",
    category: "ecommerce",
    icon: "scissors",
    systemPrompt: `You are the Etsy Shopkeeper. You help the user grow an Etsy shop.

Priorities:
1. Renewals before they lapse (lapsed listings lose search ranking).
2. Restocks before sellouts.
3. Draft replies to reviews and buyer convos — always show drafts, never auto-send.

${COMMON_SAFETY}`,
    tools: [
      "etsy.recent_receipts",
      "etsy.listings_need_attention",
      "etsy.renew_listing",
      "etsy.list_reviews",
      "etsy.shop_stats",
      "notes.save",
      "notes.list",
      "web.search",
      "time.now",
      "math.calculate",
      "report.table",
    ],
    requiredProviders: ["etsy"],
    revenueProposition:
      "Renews listings, triages reviews, tracks shop stats, protects your 5★ average.",
  },

  // ─── Creator ────────────────────────────────────────────────────────────
  {
    slug: "pinterest-pin-bot",
    name: "Pinterest Pin Bot",
    tagline: "Evergreen traffic machine",
    category: "creator",
    icon: "pin.fill",
    systemPrompt: `You are the Pinterest Pin Bot. You grow Pinterest traffic that routes to the user's store or affiliate links.

Workflow on demand:
1. Pull top-performing pins from the last 30 days.
2. Propose 3 new pins that echo what's working, each paired with an outbound link.
3. On approval, publish via pinterest.create_pin.

${COMMON_SAFETY}`,
    tools: [
      "pinterest.list_boards",
      "pinterest.create_board",
      "pinterest.top_pins",
      "pinterest.list_pins",
      "pinterest.pin_analytics",
      "pinterest.create_pin",
      "web.search",
      "web.fetch",
      "notes.save",
      "time.now",
      "math.calculate",
      "report.table",
    ],
    requiredProviders: ["pinterest"],
    revenueProposition:
      "Pinterest clicks are evergreen and convert for Shopify/Etsy/affiliate. One pin can earn for years.",
  },

  // ─── Trading ────────────────────────────────────────────────────────────
  {
    slug: "kalshi-trader",
    name: "Kalshi Trader",
    tagline: "Event contracts, regulated",
    category: "trading",
    icon: "chart.line.uptrend.xyaxis",
    systemPrompt: `You are the Kalshi Trader. You help the user research and execute on Kalshi event contracts.

Workflow:
1. Search markets that match the user's thesis.
2. Cross-reference with recent SEC filings and Congress trades when relevant.
3. Explain implied odds and volume before recommending size.
4. Propose an order (ticker, side, count, limit price) — WAIT for explicit confirmation before calling kalshi.place_order.

Risk discipline: never propose > 5% of balance on a single market without a stated edge. Log thesis + exit plan to notes for every position.

${COMMON_SAFETY}`,
    tools: [
      "kalshi.search_markets",
      "kalshi.get_market",
      "kalshi.get_balance",
      "kalshi.list_positions",
      "kalshi.list_orders",
      "kalshi.list_fills",
      "kalshi.place_order",
      "kalshi.cancel_order",
      "polymarket.search_markets",
      "polymarket.trending",
      "polymarket.market_by_slug",
      "polymarket.list_events",
      "sec.recent_filings",
      "sec.insider_trades",
      "congress.recent_trades",
      "web.search",
      "web.fetch",
      "notes.save",
      "notes.list",
      "time.now",
      "math.calculate",
      "report.table",
    ],
    requiredProviders: ["kalshi"],
    revenueProposition:
      "Researches edges, sizes trades with risk rails, executes with confirmation, manages the resulting position book.",
  },
  {
    slug: "polymarket-scout",
    name: "Polymarket Scout",
    tagline: "Read-only market radar",
    category: "trading",
    icon: "scope",
    systemPrompt: `You are the Polymarket Scout. You watch prediction markets and tell the user what's moving.

Read-only by design — no trading here. Your job is signal:
- Which markets are repricing today?
- What news is driving the move?
- How does Polymarket's price compare to Kalshi (when both exist)?

${COMMON_SAFETY}`,
    tools: [
      "polymarket.search_markets",
      "polymarket.trending",
      "polymarket.market_by_slug",
      "polymarket.list_events",
      "kalshi.search_markets",
      "kalshi.get_market",
      "web.search",
      "web.fetch",
      "notes.save",
      "time.now",
      "math.calculate",
      "report.table",
    ],
    requiredProviders: [],
    revenueProposition:
      "Daily market radar. Read-only; feeds the Kalshi Trader's thesis list.",
  },
];

/** Bots we plan to ship but haven't wired up tools for yet.
 *  Shown in the catalog with a "Coming soon" badge; not selectable. */
export const COMING_SOON: Array<Omit<Bot, "systemPrompt" | "tools">> = [
  {
    slug: "amazon-sp-clerk" as BotSlug,
    name: "Amazon SP Clerk",
    tagline: "Inventory + PPC, Amazon",
    category: "ecommerce",
    icon: "shippingbox.fill",
    requiredProviders: ["amazon-sp"],
    revenueProposition:
      "PPC optimization + stockout prevention; biggest leverage on Amazon sellers' margins.",
  },
  {
    slug: "tiktok-analyst" as BotSlug,
    name: "TikTok Analyst",
    tagline: "Which videos to remake",
    category: "creator",
    icon: "video.fill",
    requiredProviders: ["tiktok"],
    revenueProposition:
      "Doubles down on what's already working; creators spend hours on this manually.",
  },
  {
    slug: "youtube-manager" as BotSlug,
    name: "YouTube Manager",
    tagline: "Comments + rev insights",
    category: "creator",
    icon: "play.rectangle.fill",
    requiredProviders: ["youtube"],
    revenueProposition:
      "Saves 5–10 hours/week of comment triage; finds the next-video prompts hidden in replies.",
  },
  {
    slug: "substack-writer" as BotSlug,
    name: "Substack Writer",
    tagline: "Drafting + paid-sub growth",
    category: "creator",
    icon: "newspaper.fill",
    requiredProviders: ["substack"],
    revenueProposition:
      "Turns newsletter work into a 30-min/week job; churn rescue on paid subs.",
  },
  {
    slug: "gumroad-seller" as BotSlug,
    name: "Gumroad Seller",
    tagline: "Digital product launches",
    category: "ecommerce",
    icon: "square.and.arrow.up.fill",
    requiredProviders: ["gumroad"],
    revenueProposition:
      "Launch-day coordination + affiliate recruitment.",
  },
  {
    slug: "stripe-revenue" as BotSlug,
    name: "Stripe Revenue",
    tagline: "MRR, churn, dunning",
    category: "ecommerce",
    icon: "dollarsign.circle.fill",
    requiredProviders: ["stripe"],
    revenueProposition: "Churn rescue + failed-charge chasing. Pays for itself.",
  },
  {
    slug: "alpaca-equities" as BotSlug,
    name: "Alpaca Equities",
    tagline: "Commission-free stocks",
    category: "trading",
    icon: "chart.xyaxis.line",
    requiredProviders: ["alpaca"],
    revenueProposition:
      "Systematic execution with risk rails; disciplined entries and stops.",
  },
  {
    slug: "coinbase-crypto" as BotSlug,
    name: "Coinbase Crypto",
    tagline: "BTC/ETH + rebalancing",
    category: "trading",
    icon: "bitcoinsign.circle.fill",
    requiredProviders: ["coinbase"],
    revenueProposition:
      "Automates DCA + rebalance; tax-aware lot selection on sells.",
  },
];

export function getBot(slug: string): Bot | undefined {
  return BOTS.find((b) => b.slug === slug);
}

export function listCategories(): BotCategory[] {
  return ["general", "ecommerce", "trading", "creator"];
}

/** Set of providers any shipping bot might need — useful for Settings UI. */
export const SUPPORTED_PROVIDERS: string[] = Array.from(
  new Set(BOTS.flatMap((b) => b.requiredProviders))
).sort();
