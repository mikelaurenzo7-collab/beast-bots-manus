import { Router, raw } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";
import { verifyWebhookSignature } from "../_core/stripe";
import {
  decodeJwsPayload,
  decodeServerNotification,
  fetchSubscriptionStatus,
} from "../_core/appStore";
import { logger } from "../_core/logger";
import {
  findUserByShopifyShop,
  getSubscriptionByAppleTxId,
  recordWebhook,
  upsertSubscription,
} from "../db";
import { sendPushToUser } from "../_core/apns";
import type { Subscription } from "../../drizzle/schema";

export const webhooksRouter = Router();

/**
 * Both Stripe and Shopify require the raw body to verify signatures, so we
 * install a dedicated raw parser on these routes (the global JSON parser
 * mounted in _core/index.ts runs AFTER the webhooks router for that reason).
 */
const rawBody = raw({ type: "*/*", limit: "1mb" });

// ─── Stripe ────────────────────────────────────────────────────────────────

webhooksRouter.post("/stripe", rawBody, async (req, res) => {
  const sig = req.header("stripe-signature");
  if (!sig) return res.status(400).send("missing signature");
  let event: StripeEvent;
  try {
    event = verifyWebhookSignature(req.body as Buffer, sig) as StripeEvent;
  } catch (err) {
    logger.warn("stripe webhook signature invalid", { err: String(err) });
    return res.status(400).send("bad signature");
  }

  // 200 immediately — Stripe retries on timeout, not on a 200.
  res.status(200).send("ok");

  try {
    const fresh = await recordWebhook({
      provider: "stripe",
      externalId: event.id,
      topic: event.type,
      payload: event,
    });
    if (!fresh) return;

    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = extractSubscription(event);
        if (!sub) break;
        const userId = Number(sub.metadata?.userId);
        if (!Number.isFinite(userId)) break;
        await upsertSubscription({
          userId,
          plan: statusToPlan(sub.status) === "active" ? "pro" : "free",
          status: sub.status as Subscription["status"],
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }
      default:
        // Unhandled event types are fine — we recorded them above.
        break;
    }
  } catch (err) {
    logger.error("stripe webhook handler failed", { err: String(err), id: event.id });
  }
});

// ─── Shopify ───────────────────────────────────────────────────────────────

webhooksRouter.post("/shopify", rawBody, async (req, res) => {
  const hmac = req.header("x-shopify-hmac-sha256");
  const topic = req.header("x-shopify-topic") ?? "unknown";
  const shop = req.header("x-shopify-shop-domain") ?? "";
  const eventId = req.header("x-shopify-webhook-id") ?? `${shop}-${topic}-${Date.now()}`;

  if (!hmac || !verifyShopifyHmac(req.body as Buffer, hmac)) {
    logger.warn("shopify webhook rejected", { shop, topic });
    return res.status(401).send("bad hmac");
  }

  res.status(200).send("ok");

  try {
    const userId = shop ? await findUserByShopifyShop(shop) : null;
    const fresh = await recordWebhook({
      provider: "shopify",
      externalId: eventId,
      topic,
      userId: userId ?? undefined,
      payload: safeJson(req.body as Buffer),
    });
    if (!fresh || !userId) return;

    // Marquee demo: push a summary notification for new orders.
    if (topic === "orders/create") {
      const order = safeJson(req.body as Buffer) as {
        name?: string;
        total_price?: string;
        currency?: string;
      } | null;
      const title = "New Shopify order";
      const body =
        order?.name && order.total_price
          ? `${order.name} — ${order.total_price} ${order.currency ?? ""}`.trim()
          : "A new order just came in.";
      await sendPushToUser(userId, {
        title,
        body,
        data: { shop, topic },
      });
    }
  } catch (err) {
    logger.error("shopify webhook handler failed", { err: String(err), topic, shop });
  }
});

// ─── Apple — App Store Server Notifications V2 ────────────────────────────

/**
 * App Store posts a JSON body: { signedPayload: "<JWS>" }. The JWS payload
 * contains notificationType, data.signedTransactionInfo, and
 * data.signedRenewalInfo. We decode (without sig verify; the API call next
 * line is authenticated over TLS) and then re-fetch authoritative status.
 *
 * We correlate the transaction to a user via our subscriptions table, which
 * was populated when the user first verified the purchase via
 * /v1/billing/apple/verify (that path set stripeSubscriptionId =
 * originalTransactionId — yes, the column name is historical; we reuse it
 * for Apple's originalTransactionId too so renewals find the user).
 */
webhooksRouter.post("/apple", rawBody, async (req, res) => {
  let signedPayload: string;
  try {
    const body = JSON.parse((req.body as Buffer).toString("utf8"));
    signedPayload = body.signedPayload;
    if (typeof signedPayload !== "string") throw new Error("no signedPayload");
  } catch (err) {
    logger.warn("apple webhook malformed", { err: String(err) });
    return res.status(400).send("bad body");
  }

  res.status(200).send("ok");

  try {
    const notif = decodeServerNotification(signedPayload);
    const txPayload = notif.data?.signedTransactionInfo
      ? decodeJwsPayload<{
          originalTransactionId?: string;
          productId?: string;
          environment?: string;
        }>(notif.data.signedTransactionInfo)
      : null;

    const originalTxId = txPayload?.originalTransactionId;
    if (!originalTxId) return;

    const fresh = await recordWebhook({
      provider: "apple",
      externalId: `${notif.notificationType}:${originalTxId}:${Date.now()}`,
      topic: notif.notificationType,
      payload: notif,
    });
    if (!fresh) return;

    // Find the user by stored originalTransactionId.
    const sub = await getSubscriptionByAppleTxId(originalTxId);
    if (!sub) {
      logger.warn("apple webhook: no user for originalTxId", { originalTxId });
      return;
    }

    const status = await fetchSubscriptionStatus(originalTxId);
    if (!status) return;

    const active = [1, 3, 4].includes(status.status);
    await upsertSubscription({
      userId: sub.userId,
      plan: active ? "pro" : "free",
      status: active ? "active" : "canceled",
      appleOriginalTransactionId: originalTxId,
      currentPeriodEnd: status.expiresDate
        ? new Date(status.expiresDate)
        : undefined,
      cancelAtPeriodEnd: status.autoRenewStatus === 0,
    });

    if (notif.notificationType === "DID_RENEW") {
      await sendPushToUser(sub.userId, {
        title: "Bot Boss Pro renewed",
        body: status.expiresDate
          ? `Renewed through ${new Date(status.expiresDate).toLocaleDateString()}`
          : "Your subscription renewed.",
      });
    }
  } catch (err) {
    logger.error("apple webhook handler failed", { err: String(err) });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function verifyShopifyHmac(body: Buffer, hmacHeader: string): boolean {
  if (!ENV.shopifyClientSecret) return false;
  const expected = createHmac("sha256", ENV.shopifyClientSecret)
    .update(body)
    .digest("base64");
  const a = Buffer.from(expected, "base64");
  const b = Buffer.from(hmacHeader, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeJson(buf: Buffer): unknown {
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

function extractSubscription(event: StripeEvent): {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer: string;
  metadata?: Record<string, string>;
} | null {
  const obj = event.data?.object as any;
  if (!obj) return null;
  // subscription events have the subscription as the top-level object;
  // checkout.session.completed has .subscription set to the id string,
  // but it also carries .customer and metadata which is what we need.
  if (obj.object === "subscription") return obj;
  if (obj.object === "checkout.session") {
    return {
      id: obj.subscription ?? obj.id,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      cancel_at_period_end: false,
      customer: obj.customer,
      metadata: obj.metadata ?? {},
    };
  }
  return null;
}

function statusToPlan(status: string): "active" | "inactive" {
  return ["active", "trialing"].includes(status) ? "active" : "inactive";
}
