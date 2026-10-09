import Stripe from "stripe";
import type { CheckoutRequest, PaymentProvider } from "./types";

let client: Stripe | null = null;
export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!client) client = new Stripe(key, { appInfo: { name: "Ay Ay Tacos Preorders" } });
  return client;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(req: CheckoutRequest) {
    const stripe = stripeClient();
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = req.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: "usd",
        unit_amount: l.unitCents,
        product_data: { name: l.name, ...(l.description ? { description: l.description } : {}) },
      },
    }));
    if (req.taxCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: req.taxCents, product_data: { name: req.taxLabel } },
      });
    }
    // Card, Apple Pay and Google Pay are offered automatically by Stripe Checkout
    // when enabled in the Stripe Dashboard (Settings → Payment methods).
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items,
        customer_email: req.customerEmail,
        client_reference_id: req.orderId,
        metadata: { orderId: req.orderId, orderNumber: String(req.orderNumber) },
        payment_intent_data: {
          metadata: { orderId: req.orderId, orderNumber: String(req.orderNumber) },
          description: `Ay Ay Tacos order #${req.orderNumber}`,
        },
        custom_text: { submit: { message: `Estimated pickup: ${req.pickupLabel} at 117 Sweden Street, Caribou.` } },
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        expires_at: Math.floor(req.expiresAt.getTime() / 1000),
      },
      { idempotencyKey: `checkout-${req.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  },

  async getSessionStatus(sessionId: string) {
    const s = await stripeClient().checkout.sessions.retrieve(sessionId);
    return {
      paid: s.payment_status === "paid",
      expired: s.status === "expired",
      paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null,
      orderId: s.metadata?.orderId ?? s.client_reference_id ?? null,
    };
  },

  async expireSession(sessionId: string) {
    try {
      await stripeClient().checkout.sessions.expire(sessionId);
    } catch {
      // already completed or expired
    }
  },

  async refund({ paymentIntentId, amountCents, idempotencyKey }) {
    const r = await stripeClient().refunds.create(
      { payment_intent: paymentIntentId, amount: amountCents, metadata: { source: "ay-ay-tacos-admin" } },
      { idempotencyKey },
    );
    return { refundId: r.id };
  },
};
