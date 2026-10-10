import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(20),
  yieldPercent: z.number().positive().max(100).nullable().default(null),
  rawLabel: z.string().trim().max(80).nullable().default(null),
  notes: z.string().trim().max(300).nullable().default(null),
});

export const GET = route(async () => {
  await requirePermission("recipes.manage");
  return json(await prisma.ingredient.findMany({ orderBy: { name: "asc" } }));
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("recipes.manage");
  const data = ingredientSchema.parse(await req.json());
  if (await prisma.ingredient.findUnique({ where: { name: data.name } })) return json({ error: "That ingredient already exists." }, 409);
  return json(await prisma.ingredient.create({ data }), 201);
});
