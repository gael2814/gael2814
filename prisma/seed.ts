/**
 * Seeds the official Ay Ay Tacos menu, default settings and the first owner
 * account. Safe to run more than once: existing items and edits are kept.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedItem = {
  slug: string;
  name: string;
  priceCents: number;
  description?: string;
  featured?: boolean;
  priceUnderReview?: boolean;
  prepUnits: number;
  tacosPerItem?: number;
};

// prepUnits: kitchen workload per item, where 1 unit = 1 quesabirria order.
// Only the quesabirria benchmark comes from the restaurant (8 orders / 15 min);
// other values are starting estimates to tune in Admin → Menu.
const MENU: { slug: string; name: string; subtitle?: string; items: SeedItem[] }[] = [
  {
    slug: "signature",
    name: "Signature Dish",
    items: [
      {
        slug: "quesabirrias",
        name: "Quesabirrias (3) + Consomé",
        priceCents: 2200,
        description:
          "Three crispy birria tacos filled with melted cheese, onions, and cilantro, served with slow-cooked beef dipping broth.",
        featured: true,
        prepUnits: 1,
        tacosPerItem: 3,
      },
    ],
  },
  {
    slug: "favorites",
    name: "Favorites",
    items: [
      { slug: "birriamen", name: "Birriamen", priceCents: 1600, prepUnits: 1 },
      { slug: "birria-bowl", name: "Birria Bowl", priceCents: 1700, prepUnits: 1 },
      { slug: "california-burrito", name: "California Burrito", priceCents: 1800, prepUnits: 1 },
      { slug: "carne-asada-fries", name: "Carne Asada Fries", priceCents: 1800, prepUnits: 1 },
      { slug: "carnitas-plate", name: "Carnitas Plate", priceCents: 1500, prepUnits: 1 },
      { slug: "tostadas-de-tinga", name: "2 Tostadas de Tinga", priceCents: 1500, prepUnits: 1 },
    ],
  },
  {
    slug: "large-tacos",
    name: "Large Tacos",
    subtitle: "Made with fresh flour tortillas",
    items: ["Machaca", "Chorizo", "Picadillo", "Bistec"].map((n) => ({
      slug: `taco-${n.toLowerCase()}`,
      name: n,
      priceCents: 900,
      description: "Large taco made with a fresh flour tortilla.",
      priceUnderReview: true,
      prepUnits: 0.35,
    })),
  },
  {
    slug: "family-meals",
    name: "Family Meals",
    items: [
      {
        slug: "quesabirria-family-pack",
        name: "Quesabirria Family Pack",
        priceCents: 8000,
        description: "Includes 10 quesabirrias, consomé, rice, and beans.",
        priceUnderReview: true,
        prepUnits: 3.34, // 10 tacos ≈ 3⅓ quesabirria orders
        tacosPerItem: 10,
      },
    ],
  },
  {
    slug: "starters",
    name: "Starters",
    items: [
      { slug: "queso-chips", name: "Queso + Chips", priceCents: 800, prepUnits: 0.25 },
      { slug: "guacamole-chips", name: "Guacamole + Chips", priceCents: 900, prepUnits: 0.25 },
      { slug: "three-salsas-chips", name: "3 Salsas + Chips", priceCents: 600, prepUnits: 0.2 },
      { slug: "empanada", name: "Empanada", priceCents: 500, prepUnits: 0.25 },
    ],
  },
  {
    slug: "drinks",
    name: "Drinks",
    subtitle: "24 oz",
    items: [
      { slug: "jamaica", name: "Jamaica", priceCents: 600, prepUnits: 0.1 },
      { slug: "horchata", name: "Horchata", priceCents: 600, prepUnits: 0.1 },
      { slug: "strawberry-creamy", name: "Strawberry Creamy", priceCents: 750, prepUnits: 0.1 },
      { slug: "cucumber-limeade", name: "Cucumber Limeade", priceCents: 600, prepUnits: 0.1 },
      { slug: "cafe-de-olla", name: "Café de Olla", priceCents: 300, prepUnits: 0.1 },
    ],
  },
  {
    slug: "desserts",
    name: "Desserts",
    items: [
      { slug: "chocoflan", name: "Chocoflan", priceCents: 600, prepUnits: 0.05 },
      { slug: "tres-leches", name: "Tres Leches", priceCents: 600, prepUnits: 0.05 },
    ],
  },
  {
    slug: "kids",
    name: "Kids Meal",
    subtitle: "For children 12 and under",
    items: [
      {
        slug: "kids-meal",
        name: "Kids Meal",
        priceCents: 900,
        description: "One meat quesadilla, rice, and small drink. For children 12 and under.",
        prepUnits: 0.5,
      },
    ],
  },
];

async function main() {
  for (const [ci, cat] of MENU.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { slug: cat.slug, name: cat.name, subtitle: cat.subtitle ?? null, sortOrder: ci },
      update: {},
    });
    for (const [ii, item] of cat.items.entries()) {
      const exists = await prisma.menuItem.findUnique({ where: { slug: item.slug } });
      if (exists) continue;
      await prisma.menuItem.create({
        data: {
          slug: item.slug,
          name: item.name,
          priceCents: item.priceCents,
          description: item.description ?? "",
          featured: item.featured ?? false,
          priceUnderReview: item.priceUnderReview ?? false,
          prepUnits: item.prepUnits,
          tacosPerItem: item.tacosPerItem ?? 0,
          sortOrder: ii,
          categoryId: category.id,
        },
      });
    }
  }

  // Ingredients. Quantities per quesabirria taco come from the restaurant:
  // ~1 oz cooked birria, ~3 oz cheese, 1 tortilla. Other recipes are left
  // for the owner to enter (nothing is assumed).
  const ing = async (name: string, unit: string, notes?: string) =>
    prisma.ingredient.upsert({ where: { name }, create: { name, unit, notes: notes ?? null }, update: {} });
  const birria = await ing("Birria meat (cooked)", "oz", "Set a cooked yield % to also see raw meat needed.");
  const cheese = await ing("Cheese", "oz");
  const tortilla = await ing("Tortillas (quesabirria)", "each");
  await ing("Carne asada (cooked)", "oz", "Add to recipes (e.g. California Burrito, Carne Asada Fries) to include it in the report.");

  const recipe = async (slug: string, lines: [string, number][]) => {
    const item = await prisma.menuItem.findUnique({ where: { slug }, include: { recipe: true } });
    if (!item || item.recipe.length) return;
    for (const [ingredientId, quantity] of lines)
      await prisma.recipeLine.create({ data: { menuItemId: item.id, ingredientId, quantity } });
  };
  await recipe("quesabirrias", [[birria.id, 3], [cheese.id, 9], [tortilla.id, 3]]);
  await recipe("quesabirria-family-pack", [[birria.id, 10], [cheese.id, 30], [tortilla.id, 10]]);

  if ((await prisma.user.count()) === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn("No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD and re-run the seed to create the owner account.");
    } else {
      await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: process.env.ADMIN_NAME ?? "Owner",
          role: "OWNER",
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      console.log(`Created owner account ${email}`);
    }
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
