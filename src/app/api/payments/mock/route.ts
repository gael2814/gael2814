import { z } from "zod";
import { json, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { mockPaymentsAllowed } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed, releaseHold } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Test-only payment completion used when Stripe isn't configured. Disabled in production. */
export const POST = route(async (req: Request) => {
  if (!mockPaymentsAllowed()) return json({ error: "Not available" }, 404);
  const { session, outcome } = z
    .object({ session: z.string().startsWith("mock_cs_"), outcome: z.enum(["pay", "fail", "cancel"]) })
    .parse(await req.json());
  const order = await prisma.order.findUnique({ where: { paymentSessionId: session } });
  if (!order) return json({ error: "Unknown session" }, 404);
  if (outcome === "pay") await markOrderPaid({ orderId: order.id, sessionId: session, paymentIntentId: `mock_pi_${order.id}` });
  else if (outcome === "fail") await markPaymentFailed(order.id, "Test payment declined");
  else await releaseHold(order.id, "Customer cancelled payment");
  return json({ token: order.publicToken });
});
