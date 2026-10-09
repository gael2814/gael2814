import { DateTime } from "luxon";
import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSalesReport } from "@/lib/reports/sales";
import { getNow, TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("sales.view");
  const p = new URL(req.url).searchParams;
  const today = DateTime.fromJSDate(getNow(), { zone: TZ });
  const to = p.get("to") ?? today.toISODate()!;
  const from = p.get("from") ?? today.minus({ days: 27 }).toISODate()!;
  const orders = await prisma.order.findMany({
    where: { serviceDate: { gte: from, lte: to }, paymentStatus: { not: "UNPAID" } },
    include: { items: true },
  });
  return json({ from, to, report: buildSalesReport(orders) });
});
