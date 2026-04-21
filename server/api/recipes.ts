import { Router } from "express";
import { z } from "zod";
import { BOSS_DEFAULT_TOOLS } from "../../shared/boss";
import { createRecipe, getRecipe, listRecipes, updateRecipe } from "../db";
import { HttpError, requireUserId } from "../_core/middleware";

export const recipesRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(256),
  prompt: z.string().min(1),
  tools: z.array(z.string()).optional(),
  triggerKind: z.enum(["manual", "schedule", "webhook"]).optional(),
  triggerCron: z.string().optional(),
});

const updateSchema = createSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

recipesRouter.get("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    res.json({ recipes: await listRecipes(userId) });
  } catch (err) {
    next(err);
  }
});

recipesRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const id = parseInt(req.params.id, 10);
    const row = await getRecipe(userId, id);
    if (!row) throw new HttpError(404, "Recipe not found");
    res.json({ recipe: row });
  } catch (err) {
    next(err);
  }
});

recipesRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = createSchema.parse(req.body);
    const row = await createRecipe({
      userId,
      name: body.name,
      prompt: body.prompt,
      tools: body.tools ?? BOSS_DEFAULT_TOOLS,
      triggerKind: body.triggerKind,
      triggerCron: body.triggerCron,
    });
    res.json({ recipe: row });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

recipesRouter.patch("/:id", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const id = parseInt(req.params.id, 10);
    const body = updateSchema.parse(req.body);
    await updateRecipe(userId, id, body);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

recipesRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const id = parseInt(req.params.id, 10);
    await updateRecipe(userId, id, { archived: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
