import { describe, expect, test } from "vitest";
import { cronMatches } from "./scheduler";

// Build a UTC date from an ISO string so tests are deterministic regardless
// of host timezone.
const at = (iso: string) => new Date(iso);

describe("cronMatches", () => {
  test("wildcard matches everything", () => {
    expect(cronMatches("* * * * *", at("2025-01-01T00:00:00Z"))).toBe(true);
    expect(cronMatches("* * * * *", at("2025-06-15T13:37:00Z"))).toBe(true);
  });

  test("specific minute/hour", () => {
    expect(cronMatches("30 9 * * *", at("2025-04-21T09:30:00Z"))).toBe(true);
    expect(cronMatches("30 9 * * *", at("2025-04-21T09:31:00Z"))).toBe(false);
    expect(cronMatches("30 9 * * *", at("2025-04-21T10:30:00Z"))).toBe(false);
  });

  test("list of minutes", () => {
    expect(cronMatches("0,15,30,45 * * * *", at("2025-04-21T09:15:00Z"))).toBe(true);
    expect(cronMatches("0,15,30,45 * * * *", at("2025-04-21T09:20:00Z"))).toBe(false);
  });

  test("hour range (weekday mornings)", () => {
    expect(cronMatches("0 9-17 * * 1-5", at("2025-04-21T10:00:00Z"))).toBe(true); // Mon
    expect(cronMatches("0 9-17 * * 1-5", at("2025-04-20T10:00:00Z"))).toBe(false); // Sun
    expect(cronMatches("0 9-17 * * 1-5", at("2025-04-21T18:00:00Z"))).toBe(false); // after 5pm
  });

  test("day-of-month", () => {
    expect(cronMatches("0 0 1 * *", at("2025-05-01T00:00:00Z"))).toBe(true);
    expect(cronMatches("0 0 1 * *", at("2025-05-02T00:00:00Z"))).toBe(false);
  });

  test("invalid expression fails closed", () => {
    expect(cronMatches("not a cron", at("2025-01-01T00:00:00Z"))).toBe(false);
    expect(cronMatches("* * *", at("2025-01-01T00:00:00Z"))).toBe(false);
  });
});
