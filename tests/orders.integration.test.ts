import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { saveSetting } from "@/lib/settings";
import {
  cancelOrder,
  setKitchenStatus,
  changePickupTime,
  createCheckout,
  markOrderPaid,
  markPaymentFailed,
  OrderError,
  quoteOrder,
  releaseHold,
  sweepExpiredHolds,
} from "@/lib/orders";
import { getProductionReport, getIngredientReport, ensureCutoffSnapshot } from "@/lib/reports/data";
import { customer, resetDb, seedBasics, setNow } from "./helpers";

const fmt = (ms: number | Date) =>
  DateTime.fromMillis(typeof ms === "number" ? ms : ms.getTime(), { zone: "America/New_York" }).toFormat("HH:mm");
const APP = "http://localhost:3000";

let m: Awaited<ReturnType<typeof seedBasics>>;

beforeEach(async () => {
  await resetDb();
  m = await seedBasics();
  setNow("09:30");
});
afterAll(async () => {
  delete process.env.DEV_NOW_OVERRIDE;
  await prisma.$disconnect();
});

async function paidOrder(items: { menuItemId: string; quantity: number }[], over = {}) {
  const c = await createCheckout({ items, ...customer(over) }, APP);
  await markOrderPaid({ orderId: c.orderId, paymentIntentId: `pi_${c.orderId}` });
  return c;
}

describe("ordering window (server-validated)", () => {
  it("rejects checkout before 9:00 AM", async () => {
    setNow("08:59");
    await expect(createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP)).rejects.toMatchObject({
      code: "preorders_closed",
    });
  });
  it("accepts checkout at 9:00 AM", async () => {
    setNow("09:00");
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP);
    expect(c.url).toContain("/checkout/test-payment");
  });
  it("rejects checkout at 10:30 AM", async () => {
    setNow("10:30");
    await expect(quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }])).rejects.toMatchObject({ code: "preorders_closed" });
  });
  it("rejects orders on closed days and blocked dates", async () => {
    setNow("09:30", "2026-10-11"); // Sunday
    await expect(quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }])).rejects.toMatchObject({ code: "preorders_closed" });
    setNow("09:30");
    await prisma.closedDate.create({ data: { date: "2026-10-12", reason: "Holiday" } });
    await expect(quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }])).rejects.toMatchObject({ code: "preorders_closed" });
  });
  it("rejects orders when manually closed", async () => {
    await saveSetting("schedule", { manualClosed: true });
    await expect(quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }])).rejects.toMatchObject({ code: "preorders_closed" });
  });
  it("never assigns pickup before 11:00 AM", async () => {
    await saveSetting("kitchen", { kitchenStart: "09:00" });
    const q = await quoteOrder([{ menuItemId: m.jamaica.id, quantity: 1 }]);
    expect(fmt(q.pickupOptions[0])).toBe("11:00");
  });
});

describe("pricing and availability", () => {
  it("uses database prices and Maine tax", async () => {
    const q = await quoteOrder([
      { menuItemId: m.quesa.id, quantity: 2 },
      { menuItemId: m.jamaica.id, quantity: 1 },
    ]);
    expect(q.subtotalCents).toBe(5000);
    expect(q.taxCents).toBe(400); // 8%
    expect(q.totalCents).toBe(5400);
  });
  it("sold-out dishes cannot be purchased", async () => {
    await prisma.menuItem.update({ where: { id: m.burrito.id }, data: { soldOut: true } });
    await expect(createCheckout({ items: [{ menuItemId: m.burrito.id, quantity: 1 }], ...customer() }, APP)).rejects.toMatchObject({
      code: "sold_out",
    });
  });
  it("daily quantity limits are enforced, including held carts", async () => {
    await prisma.menuItem.update({ where: { id: m.burrito.id }, data: { dailyLimit: 3 } });
    await createCheckout({ items: [{ menuItemId: m.burrito.id, quantity: 2 }], ...customer() }, APP); // held, unpaid
    await expect(quoteOrder([{ menuItemId: m.burrito.id, quantity: 2 }])).rejects.toMatchObject({ code: "sold_out", extra: { remaining: 1 } });
    await expect(quoteOrder([{ menuItemId: m.burrito.id, quantity: 1 }])).resolves.toBeTruthy();
  });
  it("items hidden from preorder cannot be ordered", async () => {
    await prisma.menuItem.update({ where: { id: m.burrito.id }, data: { preorderable: false } });
    await expect(quoteOrder([{ menuItemId: m.burrito.id, quantity: 1 }])).rejects.toMatchObject({ code: "item_unavailable" });
  });
});

describe("capacity", () => {
  it("assigns 11:00 until capacity, then 11:15 (8 quesabirria orders / 15 min, cooking from 10:30)", async () => {
    // Kitchen starts at 10:30 → two intervals before 11:00 → 16 orders ready at 11:00
    for (let i = 0; i < 16; i++) {
      const c = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
      expect(fmt(c.pickupAt)).toBe("11:00");
    }
    const next = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    expect(fmt(next.pickupAt)).toBe("11:15");
  });

  it("is never overbooked", async () => {
    for (let i = 0; i < 30; i++) await paidOrder([{ menuItemId: m.quesa.id, quantity: 2 }]);
    const orders = await prisma.order.findMany({ where: { status: "CONFIRMED" }, orderBy: { pickupAt: "asc" } });
    const start = DateTime.fromISO("2026-10-12T10:30", { zone: "America/New_York" }).toMillis();
    let cum = 0;
    for (const o of orders) {
      cum += o.workUnits;
      const cap = ((o.pickupAt.getTime() - start) / (15 * 60_000)) * 8;
      expect(cum).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it("two simultaneous customers cannot reserve the same last capacity", async () => {
    // Fill 11:00–12:45 completely, leaving exactly 8 units at 13:00
    await saveSetting("kitchen", { capacityUnitsPerSlot: 8 });
    const start = DateTime.fromISO("2026-10-12T10:30", { zone: "America/New_York" });
    const cap1245 = 8 * 9; // 10:30 → 12:45 = 9 intervals
    await prisma.order.create({
      data: {
        publicToken: "filler-token-0000000000",
        serviceDate: "2026-10-12",
        pickupAt: start.plus({ minutes: 135 }).toJSDate(),
        status: "CONFIRMED",
        paymentStatus: "PAID",
        customerName: "Filler",
        customerPhone: "2075550000",
        customerEmail: "f@example.com",
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        taxRateBps: 800,
        workUnits: cap1245,
      },
    });
    const attempt = () => createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 6 }], ...customer() }, APP);
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const r of rejected) expect((r.reason as OrderError).code).toBe("no_capacity");
  });

  it("a requested pickup time that just filled up is refused with alternatives", async () => {
    const q = await quoteOrder([{ menuItemId: m.quesa.id, quantity: 16 }]);
    expect(fmt(q.pickupOptions[0])).toBe("11:00");
    await paidOrder([{ menuItemId: m.quesa.id, quantity: 16 }]);
    await expect(
      createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 16 }], requestedPickupAt: q.pickupOptions[0], ...customer() }, APP),
    ).rejects.toMatchObject({ code: "pickup_unavailable" });
  });

  it("failed and abandoned payments release capacity", async () => {
    const a = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 16 }], ...customer() }, APP);
    expect(fmt(a.pickupAt)).toBe("11:00");
    const q1 = await quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    expect(fmt(q1.pickupOptions[0])).toBe("11:15"); // held capacity counts
    await markPaymentFailed(a.orderId, "card declined");
    const q2 = await quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    expect(fmt(q2.pickupOptions[0])).toBe("11:00");

    const b = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 16 }], ...customer() }, APP);
    setNow("10:05"); // hold (31 min) expired
    const q3 = await quoteOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    expect(fmt(q3.pickupOptions[0])).toBe("11:00");
    expect(await sweepExpiredHolds()).toBe(1);
    expect((await prisma.order.findUnique({ where: { id: b.orderId } }))!.status).toBe("EXPIRED");
  });
});

describe("payments", () => {
  it("failed payments do not create confirmed orders", async () => {
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP);
    await markPaymentFailed(c.orderId, "declined");
    const o = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
    expect(o.status).toBe("EXPIRED");
    expect(o.paymentStatus).toBe("FAILED");
    // A late "paid" signal for a failed order is not accepted twice either way
    const report = await getProductionReport("2026-10-12");
    expect(report.totals.orders).toBe(0);
  });

  it("unpaid orders never appear in production or kitchen data", async () => {
    await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 3 }], ...customer() }, APP);
    const report = await getProductionReport("2026-10-12");
    expect(report.totals.orders).toBe(0);
  });

  it("confirming payment is idempotent (one order, one email)", async () => {
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP);
    const results = await Promise.all([
      markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_1" }),
      markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_1" }),
      markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_1" }),
    ]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(await prisma.order.count({ where: { status: "CONFIRMED" } })).toBe(1);
    expect(await prisma.emailLog.count({ where: { orderId: c.orderId, kind: "confirmation" } })).toBe(1);
  });

  it("double-clicking checkout reuses the same order", async () => {
    const input = { items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() };
    const a = await createCheckout(input, APP);
    const b = await createCheckout(input, APP);
    expect(b.orderId).toBe(a.orderId);
    expect(await prisma.order.count()).toBe(1);
  });

  it("a payment for a different session is ignored", async () => {
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP);
    const r = await markOrderPaid({ orderId: c.orderId, sessionId: "cs_other" });
    expect(r.changed).toBe(false);
  });

  it("releaseHold never cancels a paid order", async () => {
    const c = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    expect(await releaseHold(c.orderId, "late expiry event")).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe("CONFIRMED");
  });
});

describe("emails", () => {
  it("confirmation email contains the required details", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const sent: { subject: string; html: string; text: string; to: string[] }[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sent.push(JSON.parse(String((init as RequestInit).body)));
      return new Response("{}", { status: 200 });
    });
    try {
      const c = await createCheckout(
        {
          items: [
            { menuItemId: m.quesa.id, quantity: 2 },
            { menuItemId: m.jamaica.id, quantity: 1 },
          ],
          ...customer({ customerName: "Maria Lopez", customerEmail: "maria@example.com", notes: "Extra consomé please" }),
        },
        APP,
      );
      await markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_email" });
      expect(sent).toHaveLength(1);
      const e = sent[0];
      expect(e.to).toEqual(["maria@example.com"]);
      expect(e.subject).toBe("Your Ay Ay Tacos Order Is Confirmed! 🌮");
      for (const s of [
        "Maria Lopez",
        "Order #1001",
        "2 × Quesabirrias (3) + Consomé — $44.00",
        "1 × Jamaica — $6.00",
        "Subtotal: $50.00",
        "Maine sales tax (8.00%): $4.00",
        "Total paid: $54.00",
        "Estimated pickup time: 11:00 AM",
        "117 Sweden Street",
        "Caribou, Maine",
        "Please give us your order number when picking up.",
      ])
        expect(e.text).toContain(s);
      expect(e.html).toContain("Order #1001");
      expect(e.html).toContain("$54.00");
      expect(e.html).toContain("Extra consomé please");

      // pickup change sends an update email
      const slot = DateTime.fromISO("2026-10-12T11:30", { zone: "America/New_York" }).toJSDate();
      await changePickupTime(c.orderId, slot, "Manager");
      expect(sent).toHaveLength(2);
      expect(sent[1].subject).toContain("Updated pickup time");
      expect(sent[1].text).toContain("New pickup time: 11:30 AM");
      expect(sent[1].text).toContain("Previous time: 11:00 AM");
    } finally {
      spy.mockRestore();
      delete process.env.RESEND_API_KEY;
    }
  });
});

describe("production reports", () => {
  it("totals every confirmed order", async () => {
    await prisma.menuItem.updateMany({ data: { prepUnits: 0 } }); // unlimited capacity for this test
    for (let i = 0; i < 25; i++) await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    for (let i = 0; i < 6; i++) await paidOrder([{ menuItemId: m.burrito.id, quantity: 2 }]);
    await paidOrder([{ menuItemId: m.birriamen.id, quantity: 8 }, { menuItemId: m.jamaica.id, quantity: 15 }]);
    const r = await getProductionReport("2026-10-12");
    const byName = Object.fromEntries(r.dishes.map((d) => [d.name, d]));
    expect(byName["Quesabirrias (3) + Consomé"].quantity).toBe(25);
    expect(byName["Quesabirrias (3) + Consomé"].tacos).toBe(75);
    expect(byName["California Burrito"].quantity).toBe(12);
    expect(byName["Birriamen"].quantity).toBe(8);
    expect(byName["Jamaica"].quantity).toBe(15);
    expect(r.totals.orders).toBe(32);
    expect(r.totals.tacos).toBe(75);
  });

  it("ingredient report uses saved recipes and yields, and lists missing recipes", async () => {
    const birria = await prisma.ingredient.create({ data: { name: "Birria", unit: "oz", yieldPercent: 50 } });
    const cheese = await prisma.ingredient.create({ data: { name: "Cheese", unit: "oz" } });
    const tortilla = await prisma.ingredient.create({ data: { name: "Tortillas", unit: "each" } });
    await prisma.recipeLine.createMany({
      data: [
        { menuItemId: m.quesa.id, ingredientId: birria.id, quantity: 3 },
        { menuItemId: m.quesa.id, ingredientId: cheese.id, quantity: 9 },
        { menuItemId: m.quesa.id, ingredientId: tortilla.id, quantity: 3 },
      ],
    });
    await paidOrder([{ menuItemId: m.quesa.id, quantity: 4 }, { menuItemId: m.burrito.id, quantity: 1 }]);
    const ing = await getIngredientReport(await getProductionReport("2026-10-12"));
    const by = Object.fromEntries(ing.ingredients.map((i) => [i.name, i]));
    expect(by.Birria.quantity).toBe(12);
    expect(by.Birria.rawQuantity).toBe(24); // 50% cooked yield
    expect(by.Cheese.quantity).toBe(36);
    expect(by.Tortillas.quantity).toBe(12);
    expect(ing.missingRecipes).toEqual([{ name: "California Burrito", quantity: 1 }]);
  });

  it("cancelled orders are removed from production and listed separately", async () => {
    const a = await paidOrder([{ menuItemId: m.quesa.id, quantity: 2 }]);
    await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
    const r = await cancelOrder(a.orderId, { actor: "Owner", refund: true });
    expect(r.refundCents).toBe(4752); // $44 + 8% tax
    const o = await prisma.order.findUniqueOrThrow({ where: { id: a.orderId } });
    expect(o.status).toBe("CANCELLED");
    expect(o.paymentStatus).toBe("REFUNDED");
    const rep = await getProductionReport("2026-10-12");
    expect(rep.dishes[0].quantity).toBe(1);
    expect(rep.cancelled.orders).toBe(1);
    expect(rep.statusCounts.CANCELLED).toBe(1);
    // capacity is released for new customers
    const q = await quoteOrder([{ menuItemId: m.quesa.id, quantity: 7 }]);
    expect(fmt(q.pickupOptions[0])).toBe("11:00");
  });

  it("cutoff snapshot freezes at 10:30 while live report keeps changing", async () => {
    const a = await paidOrder([{ menuItemId: m.quesa.id, quantity: 2 }]);
    setNow("10:20");
    expect(await ensureCutoffSnapshot("2026-10-12")).toBeNull();
    setNow("11:10");
    const snap = await ensureCutoffSnapshot("2026-10-12");
    expect(snap!.production.totals.items).toBe(2);
    await cancelOrder(a.orderId, { actor: "Owner", refund: false, notify: false });
    const again = await ensureCutoffSnapshot("2026-10-12");
    expect(again!.production.totals.items).toBe(2);
    expect((await getProductionReport("2026-10-12")).totals.items).toBe(0);
  });
});

describe("ready notifications and kitchen timeline", () => {
  async function withFetchSpy(fn: (sent: { url: string; body: string }[]) => Promise<void>) {
    process.env.RESEND_API_KEY = "re_test";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM = "+12075550199";
    const sent: { url: string; body: string }[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      sent.push({ url: String(url), body: String((init as RequestInit).body) });
      return new Response("{}", { status: 200 });
    });
    try {
      await fn(sent);
    } finally {
      spy.mockRestore();
      for (const k of ["RESEND_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"]) delete process.env[k];
    }
  }

  it("tapping Ready records the time and emails + texts the customer exactly once", async () => {
    await withFetchSpy(async (sent) => {
      const c = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }], { smsOptIn: true, customerPhone: "(207) 555-0123" });
      sent.length = 0; // ignore the confirmation email
      setNow("10:50");
      await setKitchenStatus(c.orderId, "PREPARING", "Kitchen");
      setNow("10:58");
      const r = await setKitchenStatus(c.orderId, "READY", "Kitchen");
      expect(r.notified).toEqual({ email: "sent", sms: "sent" });
      const email = sent.find((s) => s.url.includes("resend"))!;
      expect(JSON.parse(email.body).subject).toBe("Your Ay Ay Tacos order #1001 is ready! 🌮");
      const sms = new URLSearchParams(sent.find((s) => s.url.includes("twilio"))!.body);
      expect(sms.get("To")).toBe("+12075550123");
      expect(sms.get("Body")).toContain("order #1001 is ready for pickup");

      // undo then Ready again: time updates, but no second message
      await setKitchenStatus(c.orderId, "PREPARING", "Kitchen");
      expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).readyAt).toBeNull();
      setNow("11:01");
      const again = await setKitchenStatus(c.orderId, "READY", "Kitchen");
      expect(again.notified).toBeNull();
      expect(sent).toHaveLength(2);

      setNow("11:06");
      await setKitchenStatus(c.orderId, "PICKED_UP", "Kitchen");
      const o = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
      expect(fmt(o.preparingAt!)).toBe("10:50");
      expect(fmt(o.readyAt!)).toBe("11:01");
      expect(fmt(o.pickedUpAt!)).toBe("11:06");
    });
  });

  it("does not text customers who didn't opt in", async () => {
    await withFetchSpy(async (sent) => {
      const c = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
      sent.length = 0;
      const r = await setKitchenStatus(c.orderId, "READY", "Kitchen");
      expect(r.notified).toEqual({ email: "sent", sms: null });
      expect(sent.filter((s) => s.url.includes("twilio"))).toHaveLength(0);
    });
  });

  it("two staff tapping Ready at the same moment still sends one message", async () => {
    await withFetchSpy(async (sent) => {
      const c = await paidOrder([{ menuItemId: m.quesa.id, quantity: 1 }]);
      sent.length = 0;
      await Promise.allSettled([setKitchenStatus(c.orderId, "READY", "A"), setKitchenStatus(c.orderId, "READY", "B")]);
      expect(sent.filter((s) => s.url.includes("resend"))).toHaveLength(1);
    });
  });
});

describe("tips (team tip pool)", () => {
  it("adds a 15% tip on the food subtotal, untaxed, and shows it on the receipt", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const sent: { text: string; html: string }[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      sent.push(JSON.parse(String((init as RequestInit).body)));
      return new Response("{}", { status: 200 });
    });
    try {
      const c = await createCheckout(
        { items: [{ menuItemId: m.quesa.id, quantity: 2 }, { menuItemId: m.jamaica.id, quantity: 1 }], tip: { type: "percent", percent: 15 }, ...customer() },
        APP,
      );
      const o = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
      expect(o.subtotalCents).toBe(5000);
      expect(o.taxCents).toBe(400); // tax on food only
      expect(o.tipCents).toBe(750); // 15% of $50
      expect(o.totalCents).toBe(6150);
      await markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_tip" });
      expect(sent[0].text).toContain("Tip for the team: $7.50");
      expect(sent[0].text).toContain("Total paid: $61.50");
      expect(sent[0].html).toContain("Gracias for your tip!");
    } finally {
      spy.mockRestore();
      delete process.env.RESEND_API_KEY;
    }
  });

  it("accepts a custom tip, defaults to no tip, and rejects absurd amounts", async () => {
    const a = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], tip: { type: "custom", cents: 500 }, ...customer() }, APP);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.orderId } })).totalCents).toBe(2200 + 176 + 500);
    const b = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, APP);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.orderId } })).tipCents).toBe(0);
    const { checkoutSchema } = await import("@/lib/orders");
    expect(checkoutSchema.safeParse({ items: [{ menuItemId: "x", quantity: 1 }], ...customer(), tip: { type: "custom", cents: 10_000_000 } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ items: [{ menuItemId: "x", quantity: 1 }], ...customer(), tip: { type: "percent", percent: 99 } }).success).toBe(false);
  });

  it("sales report keeps tips separate from restaurant revenue", async () => {
    const { buildSalesReport } = await import("@/lib/reports/sales");
    await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 2 }], tip: { type: "percent", percent: 20 }, ...customer() }, APP).then((c) =>
      markOrderPaid({ orderId: c.orderId, paymentIntentId: "pi_s" }),
    );
    const orders = await prisma.order.findMany({ include: { items: true } });
    const r = buildSalesReport(orders);
    expect(r.tipsCents).toBe(880); // 20% of $44
    expect(r.netCents).toBe(4400 + 352); // food + tax only
    expect(r.daily[0].tipsCents).toBe(880);
  });
});
