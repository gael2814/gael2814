import { prisma } from "./db";
import { getPaymentProvider, getProviderByName } from "./payments";
import { markOrderPaid } from "./orders";

export type PublicOrder = Awaited<ReturnType<typeof getPublicOrder>>;

/**
 * Customer-facing order status (no account needed; the random token in the
 * link is the key). If the payment webhook hasn't arrived yet, verifies the
 * payment directly with the provider so the customer sees confirmation quickly.
 */
export async function getPublicOrder(token: string, verifyPayment = true) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  let order = await prisma.order.findUnique({ where: { publicToken: token }, include: { items: true } });
  if (!order) return null;

  if (verifyPayment && order.status === "PENDING_PAYMENT" && order.paymentSessionId) {
    try {
      const provider = order.paymentProvider ? getProviderByName(order.paymentProvider) : getPaymentProvider();
      const s = await provider.getSessionStatus(order.paymentSessionId);
      if (s.paid && s.orderId === order.id) {
        await markOrderPaid({ orderId: order.id, sessionId: order.paymentSessionId, paymentIntentId: s.paymentIntentId });
        order = (await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } }))!;
      }
    } catch (e) {
      console.warn("Could not verify payment session", e);
    }
  }

  return {
    number: order.number,
    firstName: order.customerName.split(" ")[0],
    status: order.status,
    paymentStatus: order.paymentStatus,
    serviceDate: order.serviceDate,
    pickupAt: order.pickupAt.toISOString(),
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitCents: i.unitCents })),
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    tipCents: order.tipCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    notes: order.notes,
  };
}
