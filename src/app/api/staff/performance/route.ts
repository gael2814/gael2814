import { DateTime } from "luxon";
import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildPerformanceReport } from "@/lib/reports/performance";
import { getNow, TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("schedule.manage");
  const p = new URL(req.url).searchParams;
  const today = DateTime.fromJSDate(getNow(), { zone: TZ });
  const to = p.get("to") ?? today.toISODate()!;
  const from = p.get("from") ?? today.minus({ days: 27 }).toISODate()!;
  const [settings, orders] = await Promise.all([
    getSettings(),
    prisma.order.findMany({
      where: { serviceDate: { gte: from, lte: to }, status: { in: ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"] }, paymentStatus: { not: "UNPAID" } },
      select: { serviceDate: true, pickupAt: true, readyAt: true, pickedUpAt: true, workUnits: true },
    }),
  ]);
  const s = { kitchenStart: settings.kitchen.kitchenStart, capacityUnitsPerSlot: settings.kitchen.capacityUnitsPerSlot, slotMinutes: settings.schedule.slotMinutes };
  return json({ from, to, report: buildPerformanceReport(orders, s) });
});
