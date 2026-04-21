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
  getSubscription,
  getUserById,
  upsertSubscription,
} from "../db";

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
