import type Stripe from "stripe";
import { markOrderPaid, markPaymentFailed, releaseHold, syncRefundFromProvider } from "../orders";

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId ?? s.client_reference_id;
      if (!orderId || s.payment_status !== "paid") return;
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
      await markOrderPaid({ orderId, sessionId: s.id, paymentIntentId: pi });
      return;
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId ?? s.client_reference_id;
      if (orderId) await markPaymentFailed(orderId, "Payment failed");
      return;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId ?? s.client_reference_id;
      if (orderId) await releaseHold(orderId, "Checkout session expired without payment");
      return;
    }
    case "charge.refunded": {
      const c = event.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi) await syncRefundFromProvider(pi, c.amount_refunded);
      return;
    }
    default:
      return;
  }
}
