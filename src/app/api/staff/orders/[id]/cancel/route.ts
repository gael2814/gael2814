import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { AuthError, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cancelOrder } from "@/lib/orders";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requirePermission("orders.manage");
  const { id } = await ctx.params;
  const body = z.object({ reason: z.string().max(300).optional(), refund: z.boolean().default(false), notify: z.boolean().default(true) }).parse(await req.json());
  if (body.refund && !can(user.role, "refunds.process")) throw new AuthError(403, "Only the owner can issue refunds.");
  const r = await cancelOrder(id, { actor: user.name, reason: body.reason, refund: body.refund, notify: body.notify });
  return json({ ok: true, ...r });
});
