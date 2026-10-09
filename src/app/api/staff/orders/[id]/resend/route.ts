import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOrderEmail } from "@/lib/orders";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePermission("orders.manage");
  const { id } = await ctx.params;
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (order.paymentStatus === "UNPAID") return json({ error: "Order is not paid" }, 409);
  return json({ status: await sendOrderEmail(id, "confirmation") });
});
