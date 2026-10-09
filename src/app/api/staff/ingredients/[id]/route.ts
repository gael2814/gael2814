import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patch = z
  .object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().min(1).max(20),
    yieldPercent: z.number().positive().max(100).nullable(),
    rawLabel: z.string().trim().max(80).nullable(),
    notes: z.string().trim().max(300).nullable(),
  })
  .partial()
  .strict();

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePermission("recipes.manage");
  const { id } = await ctx.params;
  return json(await prisma.ingredient.update({ where: { id }, data: patch.parse(await req.json()) }));
});

export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePermission("recipes.manage");
  const { id } = await ctx.params;
  await prisma.ingredient.delete({ where: { id } });
  return json({ ok: true });
});
