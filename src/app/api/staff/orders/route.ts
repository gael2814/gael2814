import type { Prisma } from "@prisma/client";
import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Order history with search. Unpaid/abandoned checkouts are hidden unless requested. */
export const GET = route(async (req: Request) => {
  await requirePermission("orders.manage");
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim();
  const where: Prisma.OrderWhereInput = {};
  if (p.get("date")) where.serviceDate = p.get("date")!;
  if (p.get("from") || p.get("to")) where.serviceDate = { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined };
  if (p.get("includeUnpaid") !== "1") where.paymentStatus = { not: "UNPAID" };
  if (p.get("status")) where.status = p.get("status") as Prisma.OrderWhereInput["status"];
  if (q) {
    const n = Number(q.replace("#", ""));
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
    ];
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: [{ serviceDate: "desc" }, { pickupAt: "asc" }],
    take: 300,
  });
  return json(
    orders.map((o) => ({
      id: o.id,
      number: o.number,
      serviceDate: o.serviceDate,
      pickupAt: o.pickupAt.toISOString(),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalCents: o.totalCents,
      refundedCents: o.refundedCents,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      summary: o.items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
    })),
  );
});
