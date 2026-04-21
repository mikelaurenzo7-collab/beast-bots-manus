import { Router } from "express";
import { z } from "zod";
import { createNote, getNote, listNotes } from "../db";
import { HttpError, requireUserId } from "../_core/middleware";

export const notesRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().min(1),
});

notesRouter.get("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
    res.json({ notes: await listNotes(userId, limit) });
  } catch (err) {
    next(err);
  }
});

notesRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const id = parseInt(req.params.id, 10);
    const row = await getNote(userId, id);
    if (!row) throw new HttpError(404, "Note not found");
    res.json({ note: row });
  } catch (err) {
    next(err);
  }
});

notesRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = createSchema.parse(req.body);
    const row = await createNote({ userId, title: body.title, body: body.body });
    res.json({ note: row });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});
