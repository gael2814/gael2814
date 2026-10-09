import type { OrderStatus } from "@prisma/client";

export type ReportOrder = {
  number: number;
  customerName: string;
  pickupAt: Date;
  status: OrderStatus;
  workUnits: number;
  paidAt: Date | null;
  items: { menuItemId: string; name: string; quantity: number; tacosPerItem: number }[];
};

export type DishLine = { menuItemId: string; name: string; quantity: number; tacos: number; sortKey: number };

export type ProductionReport = {
  serviceDate: string;
  generatedAt: string;
  totals: { orders: number; items: number; tacos: number; units: number };
  dishes: DishLine[];
  slots: { at: number; orders: number; units: number; capacity: number; dishes: { name: string; quantity: number }[] }[];
  statusCounts: Record<string, number>;
  cancelled: { orders: number; dishes: { name: string; quantity: number }[] };
};

export const PRODUCTION_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

function addDish(map: Map<string, DishLine>, i: ReportOrder["items"][number], sortKey: number) {
  const d = map.get(i.menuItemId) ?? { menuItemId: i.menuItemId, name: i.name, quantity: 0, tacos: 0, sortKey };
  d.quantity += i.quantity;
  d.tacos += i.quantity * i.tacosPerItem;
  map.set(i.menuItemId, d);
}

/**
 * Consolidates every paid, non-cancelled order into what the kitchen must make.
 * `sortKeys` orders dishes the same way as the menu.
 */
export function buildProductionReport(
  serviceDate: string,
  orders: ReportOrder[],
  opts: { sortKeys?: Map<string, number>; capacityPerSlot: number; slotTimes: number[]; now?: Date },
): ProductionReport {
  const active = orders.filter((o) => PRODUCTION_STATUSES.includes(o.status));
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const sortKey = (id: string) => opts.sortKeys?.get(id) ?? 9999;

  const dishMap = new Map<string, DishLine>();
  for (const o of active) for (const i of o.items) addDish(dishMap, i, sortKey(i.menuItemId));
  const dishes = [...dishMap.values()].sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

  const slotSet = new Set(opts.slotTimes);
  for (const o of active) slotSet.add(o.pickupAt.getTime());
  const slots = [...slotSet]
    .sort((a, b) => a - b)
    .map((at) => {
      const inSlot = active.filter((o) => o.pickupAt.getTime() === at);
      const m = new Map<string, DishLine>();
      for (const o of inSlot) for (const i of o.items) addDish(m, i, sortKey(i.menuItemId));
      return {
        at,
        orders: inSlot.length,
        units: Math.round(inSlot.reduce((s, o) => s + o.workUnits, 0) * 100) / 100,
        capacity: opts.capacityPerSlot,
        dishes: [...m.values()].sort((a, b) => a.sortKey - b.sortKey).map((d) => ({ name: d.name, quantity: d.quantity })),
      };
    });

  const statusCounts: Record<string, number> = { CONFIRMED: 0, PREPARING: 0, READY: 0, PICKED_UP: 0, CANCELLED: cancelled.length };
  for (const o of active) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  const cMap = new Map<string, DishLine>();
  for (const o of cancelled) for (const i of o.items) addDish(cMap, i, sortKey(i.menuItemId));

  return {
    serviceDate,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    totals: {
      orders: active.length,
      items: dishes.reduce((s, d) => s + d.quantity, 0),
      tacos: dishes.reduce((s, d) => s + d.tacos, 0),
      units: Math.round(active.reduce((s, o) => s + o.workUnits, 0) * 100) / 100,
    },
    dishes,
    slots,
    statusCounts,
    cancelled: { orders: cancelled.length, dishes: [...cMap.values()].map((d) => ({ name: d.name, quantity: d.quantity })) },
  };
}

/** e.g. "25 Quesabirria Orders = 75 individual tacos" */
export function dishSummaryLine(d: { name: string; quantity: number; tacos: number }): string {
  return d.tacos > 0 ? `${d.quantity} × ${d.name} = ${d.tacos} individual tacos` : `${d.quantity} × ${d.name}`;
}
