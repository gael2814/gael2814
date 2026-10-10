import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { changePickupTime } from "@/lib/orders";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requirePermission("orders.manage");
  const { id } = await ctx.params;
  const { pickupAt, notify } = z.object({ pickupAt: z.number().int(), notify: z.boolean().default(true) }).parse(await req.json());
  await changePickupTime(id, new Date(pickupAt), user.name, notify);
  return json({ ok: true });
});
