import { z } from "zod";
import { json, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getProviderByName } from "@/lib/payments";
import { releaseHold } from "@/lib/orders";

export const POST = route(async (req: Request) => {
  const { token } = z.object({ token: z.string().min(16).max(64) }).parse(await req.json());
  const order = await prisma.order.findUnique({ where: { publicToken: token } });
  if (!order || order.status !== "PENDING_PAYMENT") return json({ ok: true });
  // Expire the payment session first so it can't be paid after we release the capacity.
  if (order.paymentSessionId) {
    const provider = getProviderByName(order.paymentProvider);
    await provider.expireSession(order.paymentSessionId);
    const s = await provider.getSessionStatus(order.paymentSessionId).catch(() => null);
    if (s?.paid) return json({ ok: true, paid: true });
  }
  await releaseHold(order.id, "Customer cancelled payment");
  return json({ ok: true });
});
