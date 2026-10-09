import { json, route } from "@/lib/api";
import { getPublicOrder } from "@/lib/public-order";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const order = await getPublicOrder(token);
  if (!order) return json({ error: "Order not found" }, 404);
  return json(order);
});
