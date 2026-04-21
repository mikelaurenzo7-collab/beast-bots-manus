import { z } from "zod";
import { registerTool } from "../registry";

/**
 * Format structured data as a Markdown table. Bots frequently surface
 * numbers (orders, positions, reviews) — this lets them hand the user a
 * clean table in the chat without burning tokens on ad-hoc formatting.
 */
registerTool({
  name: "report.table",
  label: "Format table",
  provider: "builtin",
  description:
    "Render an array of objects as a Markdown table. Pass `rows` (list of dicts) and optional `columns` (list of keys to include, in order). Returns the rendered Markdown.",
  input: z.object({
    rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
    columns: z.array(z.string()).optional(),
    title: z.string().optional(),
  }),
  async run({ input }) {
    if (input.rows.length === 0) {
      return {
        ok: true,
        summary: "Empty table",
        data: { markdown: "_No rows._" },
      };
    }
    const cols = input.columns ?? inferColumns(input.rows);
    const lines: string[] = [];
    if (input.title) {
      lines.push(`### ${input.title}`);
      lines.push("");
    }
    lines.push("| " + cols.join(" | ") + " |");
    lines.push("| " + cols.map(() => "---").join(" | ") + " |");
    for (const row of input.rows) {
      lines.push(
        "| " +
          cols
            .map((c) => formatCell(row[c]))
            .join(" | ") +
          " |"
      );
    }
    const markdown = lines.join("\n");
    return {
      ok: true,
      summary: `${input.rows.length}-row table`,
      data: { markdown, columns: cols, rowCount: input.rows.length },
    };
  },
});

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return Array.from(keys);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "✓" : "✗";
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
