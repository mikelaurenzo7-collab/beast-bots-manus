import { z } from "zod";
import { registerTool } from "../registry";

/**
 * Safe arithmetic evaluator. Supports +, -, *, /, %, ^ (power), parens,
 * decimals, unary minus, and a handful of functions (abs, sqrt, min, max,
 * round, floor, ceil, log, log10, exp). No identifiers leak to globals;
 * no use of eval/Function.
 *
 * Use this whenever precise numeric computation matters — position sizing,
 * dollar math, percentage conversions. The LLM is bad at arithmetic; this
 * fixes that with ~60 lines of parser.
 */
registerTool({
  name: "math.calculate",
  label: "Calculator",
  provider: "builtin",
  description:
    "Evaluate an arithmetic expression and return the precise numeric result. Supports +, -, *, /, %, ^, parens, and abs/sqrt/min/max/round/floor/ceil/log/log10/exp. Use for any trade sizing, margin, or dollar math.",
  input: z.object({
    expression: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "e.g. '0.05 * 12500' or 'min(100, 0.25 * 8000)' or 'sqrt(2) * 13.40'"
      ),
  }),
  async run({ input }) {
    try {
      const value = evaluate(input.expression);
      return {
        ok: true,
        summary: formatNumber(value),
        data: { expression: input.expression, value },
      };
    } catch (err) {
      return {
        ok: false,
        summary: "Could not evaluate expression",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  return Number.parseFloat(n.toPrecision(12)).toString();
}

// ─── Tokenizer ─────────────────────────────────────────────────────────────

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" }
  | { type: "ident"; value: string };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  abs: (a) => Math.abs(a[0]),
  sqrt: (a) => Math.sqrt(a[0]),
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  round: (a) => Math.round(a[0]),
  floor: (a) => Math.floor(a[0]),
  ceil: (a) => Math.ceil(a[0]),
  log: (a) => Math.log(a[0]),
  log10: (a) => Math.log10(a[0]),
  exp: (a) => Math.exp(a[0]),
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { out.push({ type: "lparen" }); i++; continue; }
    if (c === ")") { out.push({ type: "rparen" }); i++; continue; }
    if (c === ",") { out.push({ type: "comma" }); i++; continue; }
    if ("+-*/%^".includes(c)) { out.push({ type: "op", value: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      if (src[j] === "e" || src[j] === "E") {
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const raw = src.slice(i, j).replace(/_/g, "");
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid number: ${raw}`);
      out.push({ type: "num", value: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9]/.test(src[j])) j++;
      out.push({ type: "ident", value: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return out;
}

// ─── Parser (Pratt-style, precedence climbing) ─────────────────────────────

function evaluate(src: string): number {
  const tokens = tokenize(src);
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function consume(): Token {
    const t = tokens[pos++];
    if (!t) throw new Error("Unexpected end of expression");
    return t;
  }

  // precedence: + - : 1,  * / % : 2,  ^ : 3 (right-associative),  unary : 4
  function parseExpr(minPrec: number): number {
    let left = parsePrimary();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op") break;
      const prec = precedenceOf(t.value);
      if (prec < minPrec) break;
      consume();
      const rightAssoc = t.value === "^";
      const right = parseExpr(rightAssoc ? prec : prec + 1);
      left = apply(t.value, left, right);
    }
    return left;
  }

  function parsePrimary(): number {
    const t = consume();
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      const v = parseExpr(4);
      return t.value === "-" ? -v : v;
    }
    if (t.type === "num") return t.value;
    if (t.type === "lparen") {
      const v = parseExpr(1);
      const close = consume();
      if (close.type !== "rparen") throw new Error("Missing ')'");
      return v;
    }
    if (t.type === "ident") {
      const fn = FUNCTIONS[t.value];
      if (!fn) throw new Error(`Unknown function: ${t.value}`);
      const open = consume();
      if (open.type !== "lparen") throw new Error(`Expected '(' after ${t.value}`);
      const args: number[] = [];
      if (peek()?.type !== "rparen") {
        args.push(parseExpr(1));
        while (peek()?.type === "comma") { consume(); args.push(parseExpr(1)); }
      }
      const close = consume();
      if (close.type !== "rparen") throw new Error(`Missing ')' after ${t.value}(...)`);
      return fn(args);
    }
    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }

  const result = parseExpr(1);
  if (pos !== tokens.length) throw new Error("Trailing tokens in expression");
  return result;
}

function precedenceOf(op: string): number {
  switch (op) {
    case "+": case "-": return 1;
    case "*": case "/": case "%": return 2;
    case "^": return 3;
    default: return 0;
  }
}

function apply(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
    case "%": return a % b;
    case "^": return Math.pow(a, b);
    default: throw new Error(`Unknown operator: ${op}`);
  }
}

export { evaluate as __evaluateForTests };
