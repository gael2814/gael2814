import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("menu.availability");
  const [categories, ingredients] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { recipe: { include: { ingredient: true } } } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);
  return json({ categories, ingredients });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1),
  priceCents: z.number().int().min(0).max(100000),
  description: z.string().max(500).default(""),
  prepUnits: z.number().min(0).max(50).default(1),
  tacosPerItem: z.number().int().min(0).max(100).default(0),
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("menu.edit");
  const data = createSchema.parse(await req.json());
  let slug = data.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  if (await prisma.menuItem.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const max = await prisma.menuItem.aggregate({ where: { categoryId: data.categoryId }, _max: { sortOrder: true } });
  const item = await prisma.menuItem.create({ data: { ...data, slug, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  return json(item, 201);
});
