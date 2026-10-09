import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("orders.manage");
  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, emails: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return json({ error: "Not found" }, 404);
  const { idempotencyKey: _k, ...safe } = order;
  return json(safe);
});
