import { prisma } from "../db";
import { getSettings } from "../settings";
import { slotTimes } from "../scheduling";
import { atLocalTime, getNow } from "../time";
import { buildProductionReport, PRODUCTION_STATUSES, type ProductionReport, type ReportOrder } from "./production";
import { buildIngredientReport, type IngredientReport } from "./ingredients";

const REPORT_STATUSES = [...PRODUCTION_STATUSES, "CANCELLED" as const];

async function menuSortKeys(): Promise<Map<string, number>> {
  const items = await prisma.menuItem.findMany({ include: { category: true } });
  return new Map(items.map((i) => [i.id, i.category.sortOrder * 1000 + i.sortOrder]));
}

async function loadReportOrders(serviceDate: string, paidBefore?: Date): Promise<ReportOrder[]> {
  const rows = await prisma.order.findMany({
    where: {
      serviceDate,
      status: { in: REPORT_STATUSES },
      paymentStatus: { not: "UNPAID" },
      ...(paidBefore ? { paidAt: { lte: paidBefore } } : {}),
    },
    include: { items: true },
    orderBy: { pickupAt: "asc" },
  });
  return rows.map((o) => ({
    number: o.number,
    customerName: o.customerName,
    pickupAt: o.pickupAt,
    status: o.status,
    workUnits: o.workUnits,
    paidAt: o.paidAt,
    items: o.items.map((i) => ({ menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, tacosPerItem: i.tacosPerItem })),
  }));
}

export async function getProductionReport(serviceDate: string, paidBefore?: Date): Promise<ProductionReport> {
  const settings = await getSettings();
  const [orders, sortKeys] = await Promise.all([loadReportOrders(serviceDate, paidBefore), menuSortKeys()]);
  return buildProductionReport(serviceDate, orders, {
    sortKeys,
    capacityPerSlot: settings.kitchen.capacityUnitsPerSlot,
    slotTimes: slotTimes(serviceDate, settings.schedule),
    now: getNow(),
  });
}

export async function getIngredientReport(production: ProductionReport): Promise<IngredientReport> {
  const ids = production.dishes.map((d) => d.menuItemId);
  const lines = await prisma.recipeLine.findMany({ where: { menuItemId: { in: ids } }, include: { ingredient: true } });
  const recipes = ids.map((menuItemId) => ({
    menuItemId,
    lines: lines
      .filter((l) => l.menuItemId === menuItemId)
      .map((l) => ({
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        unit: l.ingredient.unit,
        quantity: l.quantity,
        yieldPercent: l.ingredient.yieldPercent,
        rawLabel: l.ingredient.rawLabel,
      })),
  }));
  return buildIngredientReport(production.dishes, recipes);
}

export type CutoffSnapshot = { production: ProductionReport; ingredients: IngredientReport; cutoffAt: string };

/**
 * Final preorder cutoff snapshot. Created by the scheduled job at the preorder
 * close time, or on first view after cutoff. Includes every order paid by
 * cutoff, with statuses as of when the snapshot was taken. It is never
 * overwritten, so the live report shows later changes and cancellations.
 */
export async function ensureCutoffSnapshot(serviceDate: string): Promise<CutoffSnapshot | null> {
  const existing = await prisma.productionSnapshot.findUnique({ where: { serviceDate } });
  if (existing) return existing.data as unknown as CutoffSnapshot;
  const settings = await getSettings();
  const cutoff = atLocalTime(serviceDate, settings.schedule.preorderClose).toJSDate();
  if (getNow() < cutoff) return null;
  // Payments for checkouts started before cutoff can land a few minutes later;
  // include anything paid within the payment hold window.
  const paidBefore = new Date(cutoff.getTime() + settings.kitchen.holdMinutes * 60_000);
  const production = await getProductionReport(serviceDate, getNow() < paidBefore ? undefined : paidBefore);
  const ingredients = await getIngredientReport(production);
  const data: CutoffSnapshot = { production, ingredients, cutoffAt: cutoff.toISOString() };
  try {
    await prisma.productionSnapshot.create({ data: { serviceDate, data: data as object } });
  } catch {
    const again = await prisma.productionSnapshot.findUnique({ where: { serviceDate } });
    if (again) return again.data as unknown as CutoffSnapshot;
  }
  return data;
}
