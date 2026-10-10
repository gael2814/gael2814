import { randomBytes } from "crypto";
import type { PaymentProvider } from "./types";
import { prisma } from "../db";
import { siteUrl } from "../site-url";

/**
 * Local test provider so the full ordering flow can be previewed without
 * Stripe keys. Never available in production.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(req) {
    const sessionId = `mock_cs_${randomBytes(12).toString("hex")}`;
    const base = siteUrl();
    return { sessionId, url: `${base}/checkout/test-payment?session=${sessionId}&order=${req.orderId}` };
  },
  async getSessionStatus(sessionId) {
    const order = await prisma.order.findUnique({ where: { paymentSessionId: sessionId } });
    return {
      paid: order?.paymentStatus === "PAID" || order?.paymentStatus === "PARTIALLY_REFUNDED" || order?.paymentStatus === "REFUNDED",
      expired: order?.status === "EXPIRED",
      paymentIntentId: order?.paymentIntentId ?? null,
      orderId: order?.id ?? null,
    };
  },
  async expireSession() {},
  async refund() {
    return { refundId: `mock_re_${randomBytes(8).toString("hex")}` };
  },
};
