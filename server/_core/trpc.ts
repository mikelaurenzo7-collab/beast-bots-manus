import { initTRPC } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.context<Record<string, never>>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;