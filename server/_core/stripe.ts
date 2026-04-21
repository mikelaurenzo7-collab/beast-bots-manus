import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

/**
 * Zero-dep Stripe client. We don't need the SDK for the handful of endpoints
 * we hit (customers, checkout sessions, billing portal) — direct REST keeps
 * the container tiny and the dep graph auditable.
 */

const STRIPE_API = "https://api.stripe.com/v1";

function secret(): string {
  if (!ENV.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return ENV.stripeSecretKey;
}

async function post<T>(path: string, form: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(form).toString();
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function createOrRetrieveCustomer(params: {
  userId: number;
  email?: string | null;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) return params.existingCustomerId;
  const customer = await post<{ id: string }>("/customers", {
    "metadata[userId]": String(params.userId),
    ...(params.email ? { email: params.email } : {}),
  });
  return customer.id;
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
}): Promise<{ url: string; id: string }> {
  const session = await post<{ id: string; url: string }>(
    "/checkout/sessions",
    {
      customer: params.customerId,
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: "true",
      "subscription_data[metadata][userId]": String(params.userId),
      "metadata[userId]": String(params.userId),
    }
  );
  return session;
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  return post<{ url: string }>("/billing_portal/sessions", {
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

export async function fetchSubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer: string;
  metadata?: Record<string, string>;
}> {
  const res = await fetch(`${STRIPE_API}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

/**
 * Verify a Stripe webhook signature per the `Stripe-Signature` header format.
 * Returns the parsed event on success; throws on tampered or expired signatures.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  tolerance = 5 * 60
): Record<string, unknown> {
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  // Stripe-Signature: t=<timestamp>,v1=<sig>[,v1=<sig>...]
  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((kv) => {
        const [k, v] = kv.split("=");
        return [k, v];
      })
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) throw new Error("Malformed Stripe-Signature header");

  const age = Math.floor(Date.now() / 1000) - Number(ts);
  if (!Number.isFinite(age) || age > tolerance) {
    throw new Error("Stripe signature is too old");
  }

  const expected = createHmac("sha256", ENV.stripeWebhookSecret)
    .update(`${ts}.${rawBody.toString("utf8")}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Stripe signature mismatch");
  }

  return JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
}
