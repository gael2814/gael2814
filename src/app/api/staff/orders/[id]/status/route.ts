import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { setKitchenStatus } from "@/lib/orders";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requirePermission("kitchen.status");
  const { id } = await ctx.params;
  const { status } = z.object({ status: z.enum(["CONFIRMED", "PREPARING", "READY", "PICKED_UP"]) }).parse(await req.json());
  const result = await setKitchenStatus(id, status, user.name);
  return json({ ok: true, ...result });
});
