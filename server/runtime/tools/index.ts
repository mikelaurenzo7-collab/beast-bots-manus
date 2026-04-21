/**
 * Registers every tool by side effect. Import this once at server startup.
 *
 * Every tool listed here serves at least one shipping Money Bot. When we add
 * a new bot, add its tools here and the catalog (shared/bots.ts) together.
 */

// ─── Built-ins (every bot has these) ─────────────────────────────────────
import "./web";
import "./time";
import "./notes";

// ─── Trading: research + execution ───────────────────────────────────────
import "./markets/kalshi";       // Kalshi Trader (execute)
import "./markets/polymarket";   // Polymarket Scout + Kalshi Trader (read)
import "./data/sec";             // Kalshi / future Alpaca Trader research
import "./data/congress";        // Kalshi / future Alpaca Trader research

// ─── Ecommerce: store operators ──────────────────────────────────────────
import "./commerce/shopify";     // Shopify Clerk
import "./commerce/etsy";        // Etsy Shopkeeper

// ─── Creator: traffic + monetization ─────────────────────────────────────
import "./creator/pinterest";    // Pinterest Pin Bot

