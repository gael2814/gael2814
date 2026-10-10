import type Stripe from "stripe";
import { json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { stripeClient } from "@/lib/payments/stripe";
import { handleStripeEvent } from "@/lib/payments/stripe-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. Signature is verified with STRIPE_WEBHOOK_SECRET. Each event
 * id is recorded once (PaymentEvent primary key) and order transitions are
 * guarded, so retries and duplicates can never create duplicate orders or emails.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook secret not configured" }, 500);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(body, sig ?? "", secret);
  } catch {
    return json({ error: "Invalid signature" }, 400);
  }

  const seen = await prisma.paymentEvent.findUnique({ where: { id: event.id } });
  if (seen) return json({ received: true, duplicate: true });

  try {
    await handleStripeEvent(event);
  } catch (e) {
    console.error("Stripe webhook handling failed", event.type, e);
    return json({ error: "Handler failed" }, 500); // Stripe will retry
  }
  await prisma.paymentEvent.create({ data: { id: event.id, provider: "stripe", type: event.type } }).catch(() => {});
  return json({ received: true });
}
