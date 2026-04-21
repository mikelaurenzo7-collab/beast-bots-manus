import { describe, expect, test } from "vitest";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateState,
} from "./oauth";

describe("OAuth helpers", () => {
  test("generateState returns sufficient entropy", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toEqual(b);
    // 24 bytes -> base64url length = 32.
    expect(a.length).toBe(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("generateCodeVerifier meets RFC 7636 (43-128 chars)", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("codeChallengeS256 is deterministic per verifier", () => {
    const v = "test-verifier-1234567890abcdef";
    expect(codeChallengeS256(v)).toEqual(codeChallengeS256(v));
  });

  test("codeChallengeS256 matches the RFC 7636 example", () => {
    // From https://www.rfc-editor.org/rfc/rfc7636#appendix-B
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(codeChallengeS256(verifier)).toBe(expected);
  });
});
