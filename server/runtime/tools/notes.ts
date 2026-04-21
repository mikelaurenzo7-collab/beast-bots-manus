import { z } from "zod";
import { createNote, getNote, listNotes } from "../../db";
import { registerTool } from "../registry";

registerTool({
  name: "notes.save",
  label: "Save note",
  provider: "builtin",
  description:
    "Persist a note for the user. Use this when the user says 'remember this', 'save', 'write down', or when you produce output worth keeping.",
  input: z.object({
    title: z.string().min(1).max(256),
    body: z.string().min(1),
  }),
  async run({ userId, input }) {
    const row = await createNote({ userId, title: input.title, body: input.body });
    return {
      ok: true,
      summary: `Saved note #${row.id}: ${input.title}`,
      data: { id: row.id, title: row.title },
    };
  },
});

registerTool({
  name: "notes.list",
  label: "List notes",
  provider: "builtin",
  description:
    "List the user's recent notes (id + title only). Use when the user asks what's saved or before recalling a note.",
  input: z.object({
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async run({ userId, input }) {
    const rows = await listNotes(userId, input.limit ?? 20);
    return {
      ok: true,
      summary: `${rows.length} notes`,
      data: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt })),
    };
  },
});

registerTool({
  name: "notes.get",
  label: "Read note",
  provider: "builtin",
  description: "Fetch the full body of a specific note by id.",
  input: z.object({
    id: z.number().int(),
  }),
  async run({ userId, input }) {
    const row = await getNote(userId, input.id);
    if (!row) return { ok: false, summary: `Note ${input.id} not found` };
    return {
      ok: true,
      summary: row.title,
      data: { id: row.id, title: row.title, body: row.body, updatedAt: row.updatedAt },
    };
  },
});
