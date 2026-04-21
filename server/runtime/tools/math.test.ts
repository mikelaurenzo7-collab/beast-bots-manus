import { describe, expect, test } from "vitest";
import { __evaluateForTests as evaluate } from "./math";

describe("math.calculate", () => {
  test("basic arithmetic", () => {
    expect(evaluate("1 + 2")).toBe(3);
    expect(evaluate("2 * 3 + 1")).toBe(7);
    expect(evaluate("(2 + 3) * 4")).toBe(20);
    expect(evaluate("10 / 4")).toBe(2.5);
  });

  test("operator precedence", () => {
    expect(evaluate("1 + 2 * 3")).toBe(7);
    expect(evaluate("2 + 3 * 4 - 1")).toBe(13);
    expect(evaluate("2 ^ 3")).toBe(8);
    // ^ is right-associative.
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
  });

  test("unary minus", () => {
    expect(evaluate("-5")).toBe(-5);
    expect(evaluate("-(2 + 3)")).toBe(-5);
    expect(evaluate("3 + -2")).toBe(1);
  });

  test("decimals and scientific notation", () => {
    expect(evaluate("1.5 * 2")).toBe(3);
    expect(evaluate("1e3")).toBe(1000);
    expect(evaluate("2.5e-2")).toBeCloseTo(0.025);
  });

  test("functions", () => {
    expect(evaluate("abs(-7)")).toBe(7);
    expect(evaluate("sqrt(16)")).toBe(4);
    expect(evaluate("min(3, 5, 1, 4)")).toBe(1);
    expect(evaluate("max(3, 5, 1, 4)")).toBe(5);
    expect(evaluate("round(2.6)")).toBe(3);
    expect(evaluate("floor(2.9)")).toBe(2);
    expect(evaluate("ceil(2.1)")).toBe(3);
  });

  test("realistic position sizing", () => {
    // 5% of a $12,500 balance.
    expect(evaluate("0.05 * 12500")).toBe(625);
    // Contracts at 47¢ for $200 max risk.
    expect(evaluate("floor(200 / 0.47)")).toBe(425);
    // Kelly criterion: f = p - (1 - p) / b, with p=0.6, b=1 → 0.2
    expect(evaluate("0.6 - (1 - 0.6) / 1")).toBeCloseTo(0.2);
  });

  test("rejects unsafe / unknown identifiers", () => {
    expect(() => evaluate("process")).toThrow();
    expect(() => evaluate("eval(1)")).toThrow();
    expect(() => evaluate("require('fs')")).toThrow();
    expect(() => evaluate("constructor(1)")).toThrow();
  });

  test("rejects malformed input", () => {
    expect(() => evaluate("1 +")).toThrow();
    expect(() => evaluate("(1 + 2")).toThrow();
    expect(() => evaluate("1 2")).toThrow();
    expect(() => evaluate("")).toThrow();
  });
});
