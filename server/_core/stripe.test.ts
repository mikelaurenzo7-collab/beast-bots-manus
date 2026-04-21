import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { verifyWebhookSignature } from "./stripe";

// Stripe signature format is: t=<ts>,v1=<hex sha256 of `${ts}.${body}`>
function makeSignature(ts: number, body: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

const SECRET = "whsec_test_" + "a".repeat(16);

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

describe("verifyWebhookSignature", () => {
  test("accepts a valid signature", () => {
    const body = JSON.stringify({ id: "evt_1", type: "test" });
    const ts = Math.floor(Date.now() / 1000);
    const sig = makeSignature(ts, body, SECRET);
    const event = verifyWebhookSignature(Buffer.from(body), sig);
    expect((event as any).id).toBe("evt_1");
  });

  test("rejects tampered body", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const ts = Math.floor(Date.now() / 1000);
    const sig = makeSignature(ts, body, SECRET);
    const tampered = Buffer.from(body.replace("evt_1", "evt_2"));
    expect(() => verifyWebhookSignature(tampered, sig)).toThrow();
  });

  test("rejects replay outside tolerance", () => {
    const body = "{}";
    const oldTs = Math.floor(Date.now() / 1000) - 6 * 60;
    const sig = makeSignature(oldTs, body, SECRET);
    expect(() => verifyWebhookSignature(Buffer.from(body), sig)).toThrow();
  });

  test("rejects malformed header", () => {
    const body = "{}";
    expect(() => verifyWebhookSignature(Buffer.from(body), "notasig")).toThrow();
  });
});
