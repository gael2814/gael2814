import { DateTime } from "luxon";
import type { OrderStatus } from "@prisma/client";
import { TZ } from "../time";

export type SalesOrder = {
  serviceDate: string;
  pickupAt: Date;
  status: OrderStatus;
  paymentStatus: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  items: { menuItemId: string; name: string; quantity: number; unitCents: number }[];
};

export type SalesReport = {
  grossCents: number; // total collected incl. tax
  refundsCents: number;
  netCents: number; // gross - refunds
  netSalesExTaxCents: number; // subtotal of non-cancelled orders
  taxCents: number;
  orders: number; // paid orders, excluding cancelled
  averageOrderCents: number;
  itemsSold: number;
  cancelledOrders: number;
  refundedOrders: number;
  bestSellers: { name: string; quantity: number; revenueCents: number }[];
  byPickupTime: { label: string; orders: number; revenueCents: number }[];
  daily: { date: string; orders: number; revenueCents: number }[];
  weekly: { weekStart: string; orders: number; revenueCents: number }[];
};

const PAID = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

export function buildSalesReport(all: SalesOrder[]): SalesReport {
  const paid = all.filter((o) => PAID.includes(o.paymentStatus));
  const kept = paid.filter((o) => o.status !== "CANCELLED");
  const grossCents = paid.reduce((s, o) => s + o.totalCents, 0);
  const refundsCents = paid.reduce((s, o) => s + o.refundedCents, 0);

  const best = new Map<string, { name: string; quantity: number; revenueCents: number }>();
  for (const o of kept)
    for (const i of o.items) {
      const b = best.get(i.menuItemId) ?? { name: i.name, quantity: 0, revenueCents: 0 };
      b.quantity += i.quantity;
      b.revenueCents += i.quantity * i.unitCents;
      best.set(i.menuItemId, b);
    }

  const bySlot = new Map<string, { label: string; sort: number; orders: number; revenueCents: number }>();
  const daily = new Map<string, { orders: number; revenueCents: number }>();
  const weekly = new Map<string, { orders: number; revenueCents: number }>();
  for (const o of kept) {
    const t = DateTime.fromJSDate(o.pickupAt, { zone: TZ });
    const key = t.toFormat("HH:mm");
    const s = bySlot.get(key) ?? { label: t.toFormat("h:mm a"), sort: t.hour * 60 + t.minute, orders: 0, revenueCents: 0 };
    s.orders++;
    s.revenueCents += o.totalCents - o.refundedCents;
    bySlot.set(key, s);

    const d = daily.get(o.serviceDate) ?? { orders: 0, revenueCents: 0 };
    d.orders++;
    d.revenueCents += o.totalCents - o.refundedCents;
    daily.set(o.serviceDate, d);

    const wk = DateTime.fromISO(o.serviceDate, { zone: TZ }).startOf("week").toISODate()!;
    const w = weekly.get(wk) ?? { orders: 0, revenueCents: 0 };
    w.orders++;
    w.revenueCents += o.totalCents - o.refundedCents;
    weekly.set(wk, w);
  }

  const orders = kept.length;
  const keptNet = kept.reduce((s, o) => s + o.totalCents - o.refundedCents, 0);
  return {
    grossCents,
    refundsCents,
    netCents: grossCents - refundsCents,
    netSalesExTaxCents: kept.reduce((s, o) => s + o.subtotalCents, 0),
    taxCents: kept.reduce((s, o) => s + o.taxCents, 0),
    orders,
    averageOrderCents: orders ? Math.round(keptNet / orders) : 0,
    itemsSold: kept.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0),
    cancelledOrders: paid.filter((o) => o.status === "CANCELLED").length,
    refundedOrders: paid.filter((o) => o.refundedCents > 0).length,
    bestSellers: [...best.values()].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents),
    byPickupTime: [...bySlot.values()].sort((a, b) => a.sort - b.sort).map(({ sort: _s, ...r }) => r),
    daily: [...daily.entries()].sort().map(([date, v]) => ({ date, ...v })),
    weekly: [...weekly.entries()].sort().map(([weekStart, v]) => ({ weekStart, ...v })),
  };
}
