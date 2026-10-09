import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { refundOrder } from "@/lib/orders";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requirePermission("refunds.process");
  const { id } = await ctx.params;
  const { amountCents } = z.object({ amountCents: z.number().int().positive() }).parse(await req.json());
  return json(await refundOrder(id, amountCents, user.name));
});
