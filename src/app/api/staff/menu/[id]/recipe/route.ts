import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Replaces a menu item's recipe (ingredient amounts per 1 item). */
export const PUT = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePermission("recipes.manage");
  const { id } = await ctx.params;
  const { lines } = z
    .object({ lines: z.array(z.object({ ingredientId: z.string().min(1), quantity: z.number().positive().max(100000) })).max(50) })
    .parse(await req.json());
  const ids = lines.map((l) => l.ingredientId);
  if (new Set(ids).size !== ids.length) return json({ error: "Each ingredient can only appear once." }, 400);
  await prisma.$transaction([
    prisma.recipeLine.deleteMany({ where: { menuItemId: id } }),
    prisma.recipeLine.createMany({ data: lines.map((l) => ({ menuItemId: id, ...l })) }),
  ]);
  return json({ ok: true });
});
