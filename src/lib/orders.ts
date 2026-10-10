import { randomBytes } from "crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { computeTax } from "./money";
import { getPreorderStatus } from "./preorder-window";
import { feasibleSlots, orderUnits, slotTimes, type ExistingLoad } from "./scheduling";
import { getSettings, type AllSettings } from "./settings";
import { formatTime, getNow, serviceDateOf } from "./time";
import { getPaymentProvider, getProviderByName } from "./payments";
import { sendEmail } from "./email/send";
import { cancelledEmail, confirmationEmail, pickupChangedEmail, readyEmail, readySms, refundEmail, type EmailOrder } from "./email/templates";
import { sendSms } from "./sms";
import { siteUrl } from "./site-url";

type Tx = Prisma.TransactionClient;

/** Orders that occupy kitchen capacity and count toward daily item limits. */
export const ACTIVE_PAID_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

export class OrderError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const cartSchema = z.object({
  items: z
    .array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().min(1).max(50) }))
    .min(1, "Your cart is empty")
    .max(40),
});

export const MAX_TIP_CENTS = 50_000;

export const checkoutSchema = cartSchema.extend({
  customerName: z.string().trim().min(2, "Please enter your name").max(80),
  customerPhone: z
    .string()
    .trim()
    .refine((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 15, "Please enter a valid phone number"),
  customerEmail: z.string().trim().toLowerCase().email("Please enter a valid email").max(200),
  notes: z.string().trim().max(500).optional().default(""),
  requestedPickupAt: z.number().int().optional(),
  idempotencyKey: z.string().min(8).max(100),
  /** Customer asked for a text message when the order is ready. */
  smsOptIn: z.boolean().optional().default(false),
  /** Optional tip for the team tip pool: a percent of the food subtotal, or a custom dollar amount. */
  tip: z
    .union([
      z.object({ type: z.literal("percent"), percent: z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20)]) }),
      z.object({ type: z.literal("custom"), cents: z.number().int().min(0).max(MAX_TIP_CENTS) }),
    ])
    .optional(),
});

/** Tip in cents, always computed on the server from the food subtotal (before tax). Tips are not taxed. */
export function computeTipCents(subtotalCents: number, tip: CheckoutInput["tip"]): number {
  if (!tip) return 0;
  if (tip.type === "percent") return Math.round((subtotalCents * tip.percent) / 100);
  return Math.min(tip.cents, MAX_TIP_CENTS);
}
export type CheckoutInput = z.input<typeof checkoutSchema>;

/** Active (paid, or held during payment) orders for a service day. */
function activeOrderWhere(serviceDate: string, now: Date): Prisma.OrderWhereInput {
  return {
    serviceDate,
    OR: [{ status: { in: ACTIVE_PAID_STATUSES } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
  };
}

export type PricedOrder = {
  lines: { menuItemId: string; name: string; unitCents: number; quantity: number; prepUnits: number; tacosPerItem: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRateBps: number;
  units: number;
  serviceDate: string;
  pickupOptions: number[];
};

/**
 * Validates a cart against the live menu, ordering window, daily limits and
 * kitchen capacity. Prices always come from the database, never the browser.
 */
async function priceAndSchedule(
  db: Tx | typeof prisma,
  items: { menuItemId: string; quantity: number }[],
  settings: AllSettings,
  now: Date,
): Promise<PricedOrder> {
  const closed = (await db.closedDate.findMany({ select: { date: true } })).map((c) => c.date);
  const window = getPreorderStatus(now, settings.schedule, closed);
  if (!window.open) throw new OrderError("preorders_closed", window.message, 409);
  const serviceDate = window.serviceDate;

  // merge duplicate lines
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.menuItemId, (qty.get(i.menuItemId) ?? 0) + i.quantity);

  const menu = await db.menuItem.findMany({ where: { id: { in: [...qty.keys()] } } });
  const byId = new Map(menu.map((m) => [m.id, m]));
  const limited = menu.filter((m) => m.dailyLimit != null).map((m) => m.id);
  const sold = new Map<string, number>();
  if (limited.length) {
    const rows = await db.orderItem.groupBy({
      by: ["menuItemId"],
      where: { menuItemId: { in: limited }, order: activeOrderWhere(serviceDate, now) },
      _sum: { quantity: true },
    });
    for (const r of rows) sold.set(r.menuItemId, r._sum.quantity ?? 0);
  }

  const lines: PricedOrder["lines"] = [];
  for (const [id, quantity] of qty) {
    const m = byId.get(id);
    if (!m || !m.active || !m.preorderable)
      throw new OrderError("item_unavailable", `${m?.name ?? "An item"} is not available for preorder.`, 409, { menuItemId: id });
    if (m.soldOut) throw new OrderError("sold_out", `Sorry, ${m.name} is sold out today.`, 409, { menuItemId: id });
    if (m.dailyLimit != null) {
      const left = m.dailyLimit - (sold.get(id) ?? 0);
      if (quantity > left)
        throw new OrderError(
          "sold_out",
          left <= 0 ? `Sorry, ${m.name} is sold out today.` : `Only ${left} ${m.name} left today.`,
          409,
          { menuItemId: id, remaining: Math.max(0, left) },
        );
    }
    lines.push({ menuItemId: id, name: m.name, unitCents: m.priceCents, quantity, prepUnits: m.prepUnits, tacosPerItem: m.tacosPerItem });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  const taxCents = computeTax(subtotalCents, settings.tax.rateBps);
  const units = orderUnits(lines);

  const existing: ExistingLoad[] = (
    await db.order.findMany({ where: activeOrderWhere(serviceDate, now), select: { pickupAt: true, workUnits: true } })
  ).map((o) => ({ pickupAt: o.pickupAt.getTime(), units: o.workUnits }));

  const pickupOptions = feasibleSlots(
    { serviceDate, schedule: settings.schedule, kitchen: settings.kitchen, existing, now: now.getTime() },
    units,
  );
  if (pickupOptions.length === 0)
    throw new OrderError(
      "no_capacity",
      "Our kitchen is fully booked for today's pickup times. Please call us or visit in person.",
      409,
    );

  return { lines, subtotalCents, taxCents, totalCents: subtotalCents + taxCents, taxRateBps: settings.tax.rateBps, units, serviceDate, pickupOptions };
}

export async function quoteOrder(items: { menuItemId: string; quantity: number }[]) {
  const settings = await getSettings();
  return priceAndSchedule(prisma, items, settings, getNow());
}

/**
 * Reserves kitchen capacity and creates a PENDING_PAYMENT order, then opens a
 * payment session. A per-day Postgres advisory lock serializes concurrent
 * checkouts so two customers can never book the same remaining capacity.
 */
export async function createCheckout(input: CheckoutInput, appUrl: string) {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.status === "PENDING_PAYMENT" && existing.paymentSessionId && existing.holdExpiresAt && existing.holdExpiresAt > getNow()) {
      const url = await resumeUrl(existing.paymentSessionId, existing.paymentProvider, existing.id);
      if (url) return { orderId: existing.id, publicToken: existing.publicToken, url, pickupAt: existing.pickupAt.getTime() };
    }
    if (existing.paymentStatus === "PAID")
      throw new OrderError("already_paid", "This order has already been paid.", 409, { publicToken: existing.publicToken });
    throw new OrderError("stale_checkout", "Please review your order and try again.", 409);
  }

  const settings = await getSettings();
  const provider = getPaymentProvider();

  const order = await prisma.$transaction(
    async (tx) => {
      const now = getNow();
      const serviceDate = serviceDateOf(now);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"aat-orders:" + serviceDate}))`;

      const priced = await priceAndSchedule(tx, input.items, settings, now);
      let pickupAt = priced.pickupOptions[0];
      if (input.requestedPickupAt != null) {
        if (!priced.pickupOptions.includes(input.requestedPickupAt))
          throw new OrderError(
            "pickup_unavailable",
            `That pickup time just filled up. The earliest available time is now ${formatTime(pickupAt)}.`,
            409,
            { pickupOptions: priced.pickupOptions },
          );
        pickupAt = input.requestedPickupAt;
      }

      const tipCents = computeTipCents(priced.subtotalCents, input.tip);
      return tx.order.create({
        data: {
          publicToken: randomBytes(18).toString("base64url"),
          serviceDate: priced.serviceDate,
          pickupAt: new Date(pickupAt),
          status: "PENDING_PAYMENT",
          holdExpiresAt: new Date(now.getTime() + settings.kitchen.holdMinutes * 60_000),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          notes: input.notes || null,
          smsOptIn: input.smsOptIn ?? false,
          subtotalCents: priced.subtotalCents,
          taxCents: priced.taxCents,
          tipCents,
          totalCents: priced.totalCents + tipCents,
          taxRateBps: priced.taxRateBps,
          workUnits: priced.units,
          paymentProvider: provider.name,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: priced.lines.map((l) => ({
              menuItemId: l.menuItemId,
              name: l.name,
              unitCents: l.unitCents,
              quantity: l.quantity,
              prepUnits: l.prepUnits,
              tacosPerItem: l.tacosPerItem,
            })),
          },
          events: { create: { type: "created", message: `Checkout started; pickup ${formatTime(pickupAt)} held` } },
        },
        include: { items: true },
      });
    },
    { isolationLevel: "ReadCommitted", timeout: 15_000 },
  );

  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      lines: order.items.map((i) => ({ name: i.name, unitCents: i.unitCents, quantity: i.quantity })),
      taxCents: order.taxCents,
      tipCents: order.tipCents,
      taxLabel: `${settings.tax.label} (${(order.taxRateBps / 100).toFixed(2)}%)`,
      customerEmail: order.customerEmail,
      pickupLabel: formatTime(order.pickupAt),
      successUrl: `${appUrl}/order/status/${order.publicToken}?paid=1`,
      cancelUrl: `${appUrl}/order/cancelled?token=${order.publicToken}`,
      // Stripe requires at least 30 minutes; end the session just before the hold expires.
      expiresAt: new Date(Math.max(order.holdExpiresAt!.getTime() - 60_000, Date.now() + 30 * 60_000 + 5_000)),
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentSessionId: session.sessionId } });
    return { orderId: order.id, publicToken: order.publicToken, url: session.url, pickupAt: order.pickupAt.getTime() };
  } catch (e) {
    await releaseHold(order.id, "Payment session could not be created");
    console.error("Payment session creation failed", e);
    throw new OrderError("payment_unavailable", "We couldn't start the payment. Please try again in a moment.", 502);
  }
}

async function resumeUrl(sessionId: string, providerName: string | null, orderId: string): Promise<string | null> {
  if (providerName === "mock") {
    const base = siteUrl();
    return `${base}/checkout/test-payment?session=${sessionId}&order=${orderId}`;
  }
  try {
    const { stripeClient } = await import("./payments/stripe");
    const s = await stripeClient().checkout.sessions.retrieve(sessionId);
    return s.status === "open" ? s.url : null;
  } catch {
    return null;
  }
}

/** Releases reserved capacity for an unpaid order (payment failed, abandoned or expired). */
export async function releaseHold(orderId: string, reason: string): Promise<boolean> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT", paymentStatus: "UNPAID" },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  if (res.count) await prisma.orderEvent.create({ data: { orderId, type: "expired", message: reason } });
  return res.count > 0;
}

export async function sweepExpiredHolds(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lt: getNow() } },
    select: { id: true },
  });
  for (const o of stale) await releaseHold(o.id, "Payment not completed before hold expired");
  return stale.length;
}

/**
 * Marks an order paid. Safe to call any number of times (webhook retries,
 * success-page verification): only the first call transitions the order and
 * sends the confirmation email.
 */
export async function markOrderPaid(args: { orderId: string; sessionId?: string | null; paymentIntentId?: string | null }) {
  const before = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!before) return { changed: false, reason: "not_found" as const };
  if (args.sessionId && before.paymentSessionId && before.paymentSessionId !== args.sessionId)
    return { changed: false, reason: "session_mismatch" as const };

  const res = await prisma.order.updateMany({
    where: { id: args.orderId, paymentStatus: "UNPAID", status: { in: ["PENDING_PAYMENT", "EXPIRED"] } },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paidAt: getNow(),
      holdExpiresAt: null,
      ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
    },
  });
  if (res.count === 0) return { changed: false, reason: "already_processed" as const };

  await prisma.orderEvent.create({ data: { orderId: before.id, type: "paid", message: "Payment verified; order confirmed" } });
  if (before.status === "EXPIRED") {
    await prisma.orderEvent.create({
      data: {
        orderId: before.id,
        type: "warning",
        message: "Payment arrived after the capacity hold expired. Please double-check this pickup time.",
      },
    });
  }
  await sendOrderEmail(before.id, "confirmation");
  return { changed: true as const };
}

export async function markPaymentFailed(orderId: string, reason: string) {
  const res = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "UNPAID", status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED", paymentStatus: "FAILED", holdExpiresAt: null },
  });
  if (res.count) await prisma.orderEvent.create({ data: { orderId, type: "payment_failed", message: reason } });
  return res.count > 0;
}

async function emailOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const settings = await getSettings();
  const appUrl = siteUrl();
  const eo: EmailOrder = {
    number: order.number,
    customerName: order.customerName,
    serviceDate: order.serviceDate,
    pickupAt: order.pickupAt,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitCents: i.unitCents })),
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    tipCents: order.tipCents,
    totalCents: order.totalCents,
    taxLabel: `${settings.tax.label} (${(order.taxRateBps / 100).toFixed(2)}%)`,
    notes: order.notes,
    statusUrl: `${appUrl}/order/status/${order.publicToken}`,
  };
  return { order, settings, eo };
}

export async function sendOrderEmail(
  orderId: string,
  kind: "confirmation" | "pickup_changed" | "cancelled" | "refund" | "ready",
  extra: { previousPickup?: Date; refundCents?: number } = {},
) {
  const { order, settings, eo } = await emailOrder(orderId);
  const b = settings.business;
  const msg =
    kind === "confirmation"
      ? confirmationEmail(eo, b)
      : kind === "pickup_changed"
        ? pickupChangedEmail(eo, b, extra.previousPickup ?? order.pickupAt)
        : kind === "cancelled"
          ? cancelledEmail(eo, b, extra.refundCents ?? 0)
          : kind === "ready"
            ? readyEmail(eo, b)
            : refundEmail(eo, b, extra.refundCents ?? 0);
  return sendEmail({ to: order.customerEmail, ...msg, kind, orderId });
}

const KITCHEN_FLOW: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

/**
 * One-tap kitchen status change. Records the kitchen timeline (preparing,
 * ready, picked up) for estimate accuracy, and the first time an order is
 * marked Ready the customer gets an email (and a text if they opted in).
 */
export async function setKitchenStatus(orderId: string, status: OrderStatus, actor: string) {
  if (!KITCHEN_FLOW.includes(status)) throw new OrderError("bad_status", "Use cancel to cancel an order.");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !KITCHEN_FLOW.includes(order.status) || !["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus))
    throw new OrderError("not_allowed", "Only paid, active orders can change kitchen status.", 409);
  if (order.status === status) return { notified: null };

  const now = getNow();
  // Moving forward stamps the time; moving back (an undo after a mis-tap) clears the later stamps.
  const timeline =
    status === "CONFIRMED"
      ? { preparingAt: null, readyAt: null, pickedUpAt: null }
      : status === "PREPARING"
        ? { preparingAt: order.preparingAt ?? now, readyAt: null, pickedUpAt: null }
        : status === "READY"
          ? // undoing "Picked up" keeps the original ready time
            { readyAt: order.status === "PICKED_UP" && order.readyAt ? order.readyAt : now, pickedUpAt: null }
          : { readyAt: order.readyAt ?? now, pickedUpAt: now };

  const res = await prisma.order.updateMany({ where: { id: orderId, status: order.status }, data: { status, ...timeline } });
  if (!res.count) throw new OrderError("conflict", "This order was just updated by someone else. Please try again.", 409);
  await prisma.orderEvent.create({ data: { orderId, type: "status", message: `Status → ${status}`, actor } });

  let notified: { email: string; sms: string | null } | null = null;
  if (status === "READY") {
    // Claim the notification atomically so double taps never send twice.
    const claim = await prisma.order.updateMany({ where: { id: orderId, readyNotifiedAt: null }, data: { readyNotifiedAt: now } });
    if (claim.count) {
      const email = await sendOrderEmail(orderId, "ready");
      let sms: string | null = null;
      if (order.smsOptIn) {
        const settings = await getSettings();
        sms = await sendSms({ to: order.customerPhone, body: readySms(order, settings.business), kind: "ready_sms", orderId });
      }
      notified = { email, sms };
      await prisma.orderEvent.create({
        data: { orderId, type: "notified", message: `Ready notice: email ${email}${sms ? `, text ${sms}` : ""}`, actor },
      });
    }
  }
  return { notified };
}

export async function changePickupTime(orderId: string, pickupAt: Date, actor: string, notify = true) {
  const settings = await getSettings();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const allowed = slotTimes(order.serviceDate, settings.schedule);
  if (!allowed.includes(pickupAt.getTime()))
    throw new OrderError("bad_slot", "Choose one of the configured pickup times.");
  if (!KITCHEN_FLOW.includes(order.status)) throw new OrderError("not_allowed", "This order can't be rescheduled.", 409);
  const previous = order.pickupAt;
  if (previous.getTime() === pickupAt.getTime()) return;
  await prisma.order.update({ where: { id: orderId }, data: { pickupAt } });
  await prisma.orderEvent.create({
    data: { orderId, type: "pickup_changed", message: `Pickup ${formatTime(previous)} → ${formatTime(pickupAt)}`, actor },
  });
  if (notify) await sendOrderEmail(orderId, "pickup_changed", { previousPickup: previous });
}

export async function refundOrder(orderId: string, amountCents: number, actor: string, notify = true) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.paymentIntentId && order.paymentProvider !== "mock")
    throw new OrderError("not_paid", "This order has no captured payment to refund.", 409);
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus))
    throw new OrderError("not_paid", "This order is not in a refundable state.", 409);
  const refundable = order.totalCents - order.refundedCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > refundable)
    throw new OrderError("bad_amount", `Refund must be between $0.01 and $${(refundable / 100).toFixed(2)}.`);

  const provider = getProviderByName(order.paymentProvider);
  const { refundId } = await provider.refund({
    paymentIntentId: order.paymentIntentId ?? `mock_pi_${order.id}`,
    amountCents,
    idempotencyKey: `refund-${order.id}-${order.refundedCents}-${amountCents}`,
  });
  const refunded = order.refundedCents + amountCents;
  // Guard on the previous refunded amount so concurrent refunds can't double count.
  const res = await prisma.order.updateMany({
    where: { id: orderId, refundedCents: order.refundedCents },
    data: { refundedCents: refunded, paymentStatus: refunded >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED" },
  });
  if (!res.count) throw new OrderError("conflict", "Another refund was processed at the same time. Please refresh.", 409);
  await prisma.orderEvent.create({
    data: { orderId, type: "refund", message: `Refunded $${(amountCents / 100).toFixed(2)} (${refundId})`, actor },
  });
  if (notify) await sendOrderEmail(orderId, "refund", { refundCents: amountCents });
  return { refundedCents: refunded };
}

/** Records refunds made directly in the Stripe Dashboard (charge.refunded webhook). */
export async function syncRefundFromProvider(paymentIntentId: string, totalRefundedCents: number) {
  const order = await prisma.order.findUnique({ where: { paymentIntentId } });
  if (!order || totalRefundedCents <= order.refundedCents) return;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      refundedCents: totalRefundedCents,
      paymentStatus: totalRefundedCents >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });
  await prisma.orderEvent.create({
    data: { orderId: order.id, type: "refund", message: `Refund recorded from payment provider (total $${(totalRefundedCents / 100).toFixed(2)})` },
  });
}

export async function cancelOrder(orderId: string, opts: { actor: string; reason?: string; refund: boolean; notify?: boolean }) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!KITCHEN_FLOW.includes(order.status) || order.status === "PICKED_UP")
    throw new OrderError("not_allowed", "Only confirmed orders that haven't been picked up can be cancelled.", 409);
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: "CANCELLED", cancelledAt: getNow(), cancelReason: opts.reason ?? null },
  });
  if (!res.count) throw new OrderError("conflict", "Order changed. Please refresh.", 409);
  await prisma.orderEvent.create({
    data: { orderId, type: "cancelled", message: `Cancelled${opts.reason ? `: ${opts.reason}` : ""}`, actor: opts.actor },
  });
  let refundCents = 0;
  if (opts.refund) {
    const remaining = order.totalCents - order.refundedCents;
    if (remaining > 0) {
      await refundOrder(orderId, remaining, opts.actor, false);
      refundCents = remaining;
    }
  }
  if (opts.notify !== false) await sendOrderEmail(orderId, "cancelled", { refundCents });
  return { refundCents };
}
