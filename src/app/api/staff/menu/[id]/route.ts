import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { AuthError, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";

const FIELD_PERMS: Record<string, Permission> = {
  name: "menu.edit",
  description: "menu.edit",
  priceCents: "menu.edit",
  categoryId: "menu.edit",
  imageId: "menu.edit",
  featured: "menu.edit",
  priceUnderReview: "menu.edit",
  active: "menu.edit",
  sortOrder: "menu.edit",
  soldOut: "menu.availability",
  dailyLimit: "menu.availability",
  preorderable: "menu.availability",
  prepUnits: "menu.prep",
  tacosPerItem: "menu.prep",
  productionNote: "menu.prep",
};

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    priceCents: z.number().int().min(0).max(100000),
    categoryId: z.string().min(1),
    imageId: z.string().nullable(),
    featured: z.boolean(),
    priceUnderReview: z.boolean(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    soldOut: z.boolean(),
    dailyLimit: z.number().int().min(0).max(10000).nullable(),
    preorderable: z.boolean(),
    prepUnits: z.number().min(0).max(50),
    tacosPerItem: z.number().int().min(0).max(100),
    productionNote: z.string().max(300).nullable(),
  })
  .partial()
  .strict();

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requirePermission("menu.availability");
  const { id } = await ctx.params;
  const data = patchSchema.parse(await req.json());
  for (const key of Object.keys(data))
    if (!can(user.role, FIELD_PERMS[key])) throw new AuthError(403, `You don't have permission to change ${key}.`);
  const item = await prisma.menuItem.update({ where: { id }, data });
  return json(item);
});

export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePermission("menu.edit");
  const { id } = await ctx.params;
  const used = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) {
    // Keep history intact: hide instead of deleting.
    await prisma.menuItem.update({ where: { id }, data: { active: false, preorderable: false } });
    return json({ archived: true });
  }
  await prisma.menuItem.delete({ where: { id } });
  return json({ deleted: true });
});
