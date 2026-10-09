import { prisma } from "@/lib/db";
import { saveSetting } from "@/lib/settings";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "OrderEvent","EmailLog","OrderItem","Order","PaymentEvent","RecipeLine","Ingredient","MenuItem","Category","Image","ClosedDate","ProductionSnapshot","Setting","User" RESTART IDENTITY CASCADE`,
  );
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001`);
}

/** Monday 2026-10-12 (EDT) */
export function setNow(hhmm: string, date = "2026-10-12") {
  process.env.DEV_NOW_OVERRIDE = `${date}T${hhmm}:00`;
}

export async function seedBasics() {
  const cat = await prisma.category.create({ data: { slug: "main", name: "Main", sortOrder: 0 } });
  const drinks = await prisma.category.create({ data: { slug: "drinks", name: "Drinks", sortOrder: 1 } });
  const quesa = await prisma.menuItem.create({
    data: { slug: "quesabirrias", name: "Quesabirrias (3) + Consomé", priceCents: 2200, prepUnits: 1, tacosPerItem: 3, categoryId: cat.id },
  });
  const burrito = await prisma.menuItem.create({
    data: { slug: "california-burrito", name: "California Burrito", priceCents: 1800, prepUnits: 1, categoryId: cat.id, sortOrder: 1 },
  });
  const birriamen = await prisma.menuItem.create({
    data: { slug: "birriamen", name: "Birriamen", priceCents: 1600, prepUnits: 1, categoryId: cat.id, sortOrder: 2 },
  });
  const jamaica = await prisma.menuItem.create({
    data: { slug: "jamaica", name: "Jamaica", priceCents: 600, prepUnits: 0.1, categoryId: drinks.id },
  });
  await saveSetting("schedule", { operatingDays: [1, 2, 3, 4, 5] });
  return { quesa, burrito, birriamen, jamaica };
}

let n = 0;
export function customer(over: Record<string, unknown> = {}) {
  n++;
  return {
    customerName: "Maria Lopez",
    customerPhone: "207-555-0100",
    customerEmail: "maria@example.com",
    notes: "",
    idempotencyKey: `test-key-${Date.now()}-${n}-${Math.random()}`,
    ...over,
  };
}
