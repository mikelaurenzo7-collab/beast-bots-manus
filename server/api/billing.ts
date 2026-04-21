import { Router } from "express";
import { z } from "zod";
import { HttpError, requireUserId } from "../_core/middleware";
import { ENV } from "../_core/env";
import {
  createBillingPortalSession,
  createCheckoutSession,
  createOrRetrieveCustomer,
} from "../_core/stripe";
import {
  fetchSubscriptionStatus,
  isAppStoreConfigured,
} from "../_core/appStore";
import {
  getSubscription,
  getUserById,
  upsertSubscription,
} from "../db";
import { logger } from "../_core/logger";

export const billingRouter = Router();

const checkoutSchema = z.object({
  cadence: z.enum(["monthly", "yearly"]),
  returnTo: z.string().url().optional(),
});

/**
 * POST /v1/billing/checkout  (auth required)
 *
 * Mints a Stripe Checkout URL for the Pro plan and ensures the user has a
 * Stripe customer record. Response: { url }
 */
billingRouter.post("/checkout", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = checkoutSchema.parse(req.body);

    const priceId =
      body.cadence === "monthly"
        ? ENV.stripePriceProMonthly
        : ENV.stripePriceProYearly;
    if (!priceId) {
      throw new HttpError(500, "Stripe price not configured for that cadence");
    }

    const sub = await getSubscription(userId);
    const user = await getUserById(userId);
    const customerId = await createOrRetrieveCustomer({
      userId,
      email: user?.email,
      existingCustomerId: sub?.stripeCustomerId ?? null,
    });

    // Persist the customer id even if the user drops off before paying, so
    // subsequent attempts don't create duplicate Stripe customers.
    if (!sub?.stripeCustomerId) {
      await upsertSubscription({
        userId,
        plan: sub?.plan ?? "free",
        status: sub?.status ?? "active",
        stripeCustomerId: customerId,
      });
    }

    const session = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: body.returnTo ?? ENV.stripeSuccessUrl,
      cancelUrl: body.returnTo ?? ENV.stripeCancelUrl,
      userId,
    });

    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

/**
 * POST /v1/billing/portal (auth required)
 *
 * Opens Stripe's hosted billing portal for the signed-in customer.
 */
billingRouter.post("/portal", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const sub = await getSubscription(userId);
    if (!sub?.stripeCustomerId) throw new HttpError(400, "No Stripe customer yet");
    const { url } = await createBillingPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: ENV.stripeSuccessUrl,
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/billing/subscription — the user's current plan/status. */
billingRouter.get("/subscription", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const sub = await getSubscription(userId);
    res.json({
      plan: sub?.plan ?? "free",
      status: sub?.status ?? "active",
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    });
  } catch (err) {
    next(err);
  }
});

const appleVerifySchema = z.object({
  transactionId: z.string().min(1),
  /** Whether the buy happened in StoreKit's sandbox (TestFlight = sandbox). */
  sandbox: z.boolean().optional(),
});

/**
 * POST /v1/billing/apple/verify  (auth required)
 *
 * Called by the iOS app after a StoreKit 2 purchase. Looks the transaction
 * up via the App Store Server API, persists the resulting subscription in
 * our subscriptions table, and returns the updated plan.
 */
billingRouter.post("/apple/verify", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!isAppStoreConfigured()) {
      throw new HttpError(500, "App Store Server API not configured");
    }
    const body = appleVerifySchema.parse(req.body);
    const status = await fetchSubscriptionStatus(body.transactionId);
    if (!status) throw new HttpError(404, "Transaction not found");

    // status codes: 1=active, 3=in retry, 4=grace → allow Pro; else demote.
    const isActive = [1, 3, 4].includes(status.status);
    await upsertSubscription({
      userId,
      plan: isActive ? "pro" : "free",
      status: mapAppStoreStatus(status.status),
      appleOriginalTransactionId: status.originalTransactionId,
      currentPeriodEnd: status.expiresDate
        ? new Date(status.expiresDate)
        : undefined,
      cancelAtPeriodEnd: status.autoRenewStatus === 0,
    });
    logger.info("apple IAP verified", {
      userId,
      productId: status.productId,
      status: status.status,
    });
    res.json({
      plan: isActive ? "pro" : "free",
      productId: status.productId,
      expiresAt: status.expiresDate
        ? new Date(status.expiresDate).toISOString()
        : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

function mapAppStoreStatus(
  code: number
):
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete" {
  switch (code) {
    case 1:
      return "active";
    case 2:
      return "canceled"; // expired
    case 3:
      return "past_due"; // in billing retry
    case 4:
      return "active"; // in grace period — still entitled
    case 5:
      return "canceled"; // revoked
    default:
      return "incomplete";
  }
}
