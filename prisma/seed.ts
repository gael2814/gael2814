/**
 * Seeds the official Ay Ay Tacos menu, default settings and the first owner
 * account. Safe to run more than once: existing items and edits are kept.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type SeedItem = {
  slug: string;
  name: string;
  priceCents: number;
  description?: string;
  pronunciation?: string;
  featured?: boolean;
  priceUnderReview?: boolean;
  prepUnits: number;
  tacosPerItem?: number;
};

// Names, prices and descriptions are taken from the official printed menu.
// (Kids Meal is $9 per the owner; the printed menu still shows $11.)
// prepUnits: kitchen workload per item, where 1 unit = 1 quesabirria order.
// Only the quesabirria benchmark comes from the restaurant (8 orders / 15 min);
// other values are starting estimates to tune in Admin → Menu.
const MENU: { slug: string; name: string; subtitle?: string; items: SeedItem[] }[] = [
  {
    slug: "signature",
    name: "Signature Dish",
    subtitle: "Our most popular dish. Start here!",
    items: [
      {
        slug: "quesabirrias",
        name: "Quesabirrias (3) + Consomé",
        pronunciation: "keh-sah-bee-REE-ahs · kohn-soh-MAY",
        priceCents: 2200,
        description:
          "Three crispy birria tacos filled with melted cheese, onions and cilantro, served with our slow-cooked beef dipping broth.",
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
      {
        slug: "birriamen",
        name: "Birriamen",
        priceCents: 1600,
        description: "Ramen noodles in our rich birria broth with slow-cooked beef, onions, cilantro and lime.",
        prepUnits: 1,
      },
      {
        slug: "birria-bowl",
        name: "Birria Bowl",
        priceCents: 1700,
        description: "Slow-cooked birria beef with rice, beans, queso, onions, cilantro and salsa.",
        prepUnits: 1,
      },
      {
        slug: "california-burrito",
        name: "California Burrito",
        priceCents: 1800,
        description:
          "Carne asada (grilled steak), French fries, cheese, pico de gallo and creamy sauce in a flour tortilla.",
        prepUnits: 1,
      },
      {
        slug: "carne-asada-fries",
        name: "Carne Asada Fries",
        priceCents: 1800,
        description: "Crispy fries loaded with grilled steak, queso, crema, pico de gallo and salsa. Great for sharing.",
        prepUnits: 1,
      },
      {
        slug: "carnitas-plate",
        name: "Carnitas Plate",
        pronunciation: "kar-NEE-tahs",
        priceCents: 1500,
        description: "Tender slow-cooked pork with rice, beans, onions, cilantro and salsa.",
        prepUnits: 1,
      },
      {
        slug: "tostadas-de-tinga",
        name: "2 Tostadas de Tinga",
        priceCents: 1500,
        description:
          "Two crispy flat corn tortillas topped with shredded chicken tinga (TEEN-gah), lettuce, crema, queso and salsa.",
        prepUnits: 1,
      },
    ],
  },
  {
    slug: "large-tacos",
    name: "Tacos",
    subtitle: "Large tacos on fresh flour tortillas · mix and match",
    items: [
      ["Machaca", "Shredded seasoned beef with onion and cilantro."],
      ["Chorizo", "Mexican-style chorizo sausage with potatoes and egg."],
      ["Picadillo", "Seasoned ground beef with potatoes."],
      ["Bistec", "Grilled steak with onions and cilantro."],
    ].map(([n, description]) => ({
      slug: `taco-${n.toLowerCase()}`,
      name: n,
      priceCents: 900,
      description,
      priceUnderReview: true,
      prepUnits: 0.35,
    })),
  },
  {
    slug: "family-meals",
    name: "Family Meals",
    subtitle: "Feeds the whole table",
    items: [
      {
        slug: "quesabirria-family-pack",
        name: "Quesabirria Family Pack",
        priceCents: 8000,
        description:
          "10 quesabirrias + consomé + rice + beans. Our most popular dish, made for sharing: crispy, cheesy birria tacos for everyone, with broth for dipping.",
        priceUnderReview: true,
        prepUnits: 3.34, // 10 tacos ≈ 3⅓ quesabirria orders
        tacosPerItem: 10,
      },
    ],
  },
  {
    slug: "starters",
    name: "Starters",
    subtitle: "to share",
    items: [
      { slug: "queso-chips", name: "Queso + Chips", priceCents: 800, description: "Melted cheese dip.", prepUnits: 0.25 },
      { slug: "guacamole-chips", name: "Guacamole + Chips", priceCents: 900, description: "Mashed avocado dip.", prepUnits: 0.25 },
      { slug: "three-salsas-chips", name: "3 Salsas + Chips", priceCents: 600, prepUnits: 0.2 },
      {
        slug: "empanada",
        name: "Empanada",
        priceCents: 500,
        description: "One flaky pastry turnover with a savory filling.",
        prepUnits: 0.25,
      },
    ],
  },
  {
    slug: "drinks",
    name: "Drinks",
    subtitle: "24 oz",
    items: [
      {
        slug: "jamaica",
        name: "Jamaica",
        pronunciation: "hah-MY-kah",
        priceCents: 600,
        description: "Hibiscus flower drink. Fruity, refreshing and slightly tart.",
        prepUnits: 0.1,
      },
      {
        slug: "horchata",
        name: "Horchata",
        pronunciation: "or-CHAH-tah",
        priceCents: 600,
        description: "Sweet, creamy cinnamon rice drink.",
        prepUnits: 0.1,
      },
      { slug: "strawberry-creamy", name: "Strawberry Creamy", priceCents: 750, prepUnits: 0.1 },
      { slug: "cucumber-limeade", name: "Cucumber Limeade", priceCents: 600, prepUnits: 0.1 },
      {
        slug: "cafe-de-olla",
        name: "Café de Olla",
        priceCents: 300,
        description: "Hot Mexican coffee with warm cinnamon flavor.",
        prepUnits: 0.1,
      },
    ],
  },
  {
    slug: "desserts",
    name: "Dessert",
    subtitle: "per slice",
    items: [
      {
        slug: "chocoflan",
        name: "Chocoflan",
        priceCents: 600,
        description: "Chocolate cake and creamy flan baked together.",
        prepUnits: 0.05,
      },
      { slug: "tres-leches", name: "Tres Leches", priceCents: 600, description: "Soft sponge cake soaked in three milks.", prepUnits: 0.05 },
    ],
  },
  {
    slug: "kids",
    name: "Kids Meal",
    subtitle: "For kids 12 and under",
    items: [
      {
        slug: "kids-meal",
        name: "Kids Meal",
        priceCents: 900,
        description: "For kids 12 and under. 1 meat quesadilla + rice + small drink.",
        prepUnits: 0.5,
      },
    ],
  },
];

// Photos cropped from the official printed menu.
const PHOTO_DIR = path.join(__dirname, "seed-assets", "menu");

async function main() {
  for (const [ci, cat] of MENU.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { slug: cat.slug, name: cat.name, subtitle: cat.subtitle ?? null, sortOrder: ci },
      update: {},
    });
    if (!category.subtitle && cat.subtitle)
      await prisma.category.update({ where: { id: category.id }, data: { subtitle: cat.subtitle } });
    for (const [ii, item] of cat.items.entries()) {
      const exists = await prisma.menuItem.findUnique({ where: { slug: item.slug } });
      if (exists) {
        // Never overwrite owner edits; only fill in details that are still blank.
        const fill: { description?: string; pronunciation?: string } = {};
        if (!exists.description && item.description) fill.description = item.description;
        if (!exists.pronunciation && item.pronunciation) fill.pronunciation = item.pronunciation;
        if (Object.keys(fill).length) await prisma.menuItem.update({ where: { id: exists.id }, data: fill });
        continue;
      }
      await prisma.menuItem.create({
        data: {
          slug: item.slug,
          name: item.name,
          priceCents: item.priceCents,
          description: item.description ?? "",
          pronunciation: item.pronunciation ?? null,
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

  // Attach menu photos to items that don't have one yet.
  if (fs.existsSync(PHOTO_DIR)) {
    for (const file of fs.readdirSync(PHOTO_DIR).filter((f) => f.endsWith(".jpg"))) {
      const item = await prisma.menuItem.findUnique({ where: { slug: file.replace(/\.jpg$/, "") } });
      if (!item || item.imageId) continue;
      const img = await prisma.image.create({ data: { contentType: "image/jpeg", data: fs.readFileSync(path.join(PHOTO_DIR, file)) } });
      await prisma.menuItem.update({ where: { id: item.id }, data: { imageId: img.id } });
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
