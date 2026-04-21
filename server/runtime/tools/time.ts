import { z } from "zod";
import { registerTool } from "../registry";

registerTool({
  name: "time.now",
  label: "Current time",
  provider: "builtin",
  description:
    "Return the current date and time in ISO 8601. Use when the user's request depends on 'now', 'today', or time math.",
  input: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA tz name (e.g. America/Los_Angeles). Defaults to UTC."),
  }),
  async run({ input }) {
    const tz = input.timezone ?? "UTC";
    const now = new Date();
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
    } catch {
      formatted = now.toISOString();
    }
    return {
      ok: true,
      summary: formatted,
      data: { iso: now.toISOString(), timezone: tz, formatted },
    };
  },
});
