import { prisma } from "./db";
import { getSettings } from "./settings";
import { buildSlots, slotTimes } from "./scheduling";
import { getNow } from "./time";
import { ACTIVE_PAID_STATUSES } from "./orders";

/** Paid orders for the kitchen screen, sorted by pickup time. Unpaid orders never appear. */
export async function getKitchenBoard(serviceDate: string) {
  const settings = await getSettings();
  const now = getNow();
  const orders = await prisma.order.findMany({
    where: { serviceDate, status: { in: [...ACTIVE_PAID_STATUSES, "CANCELLED"] }, paymentStatus: { not: "UNPAID" } },
    include: { items: { orderBy: { name: "asc" } }, events: { where: { type: "warning" } } },
    orderBy: [{ pickupAt: "asc" }, { number: "asc" }],
  });
  const pendingHolds = await prisma.order.count({
    where: { serviceDate, status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
  });
  const active = orders.filter((o) => o.status !== "CANCELLED");
  const slots = buildSlots({
    serviceDate,
    schedule: settings.schedule,
    kitchen: settings.kitchen,
    existing: active.map((o) => ({ pickupAt: o.pickupAt.getTime(), units: o.workUnits })),
    now: 0, // show full-day capacity on the kitchen screen
  });
  return {
    serviceDate,
    now: now.toISOString(),
    dueSoonMinutes: settings.kitchen.dueSoonMinutes,
    pendingPayments: pendingHolds,
    slotOptions: slotTimes(serviceDate, settings.schedule),
    slots: slots.map((s) => ({ at: s.at, units: s.bookedUnits, orders: s.bookedOrders, cumulative: s.cumulativeUnits, capacity: s.cumulativeCapacity })),
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      pickupAt: o.pickupAt.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      notes: o.notes,
      totalCents: o.totalCents,
      paidAt: o.paidAt?.toISOString() ?? null,
      warnings: o.events.map((e) => e.message),
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, tacos: i.quantity * i.tacosPerItem })),
    })),
  };
}
