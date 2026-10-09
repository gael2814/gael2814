import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createCheckout } from "@/lib/orders";
import { can, PERMISSIONS } from "@/lib/permissions";
import { signSession } from "@/lib/auth-token";
import { customer, resetDb, seedBasics, setNow } from "./helpers";

// next/headers cookies() mock so route handlers can be called directly
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { name: n, value: cookieJar.get(n)! } : undefined),
    set: (n: string, v: string) => cookieJar.set(n, v),
    delete: (n: string) => cookieJar.delete(n),
  }),
}));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_dummy");

let m: Awaited<ReturnType<typeof seedBasics>>;
beforeEach(async () => {
  await resetDb();
  m = await seedBasics();
  setNow("09:30");
  cookieJar.clear();
});
afterAll(async () => {
  delete process.env.DEV_NOW_OVERRIDE;
  await prisma.$disconnect();
});

function signedRequest(event: object, secret = "whsec_test_secret") {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/payments/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

function completedEvent(id: string, orderId: string, sessionId: string, paid = true) {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: paid ? "paid" : "unpaid",
        payment_intent: "pi_webhook_1",
        client_reference_id: orderId,
        metadata: { orderId },
      },
    },
  };
}

describe("Stripe webhook", () => {
  it("rejects unsigned / wrongly signed requests", async () => {
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, "http://x");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
    const res = await POST(signedRequest(completedEvent("evt_bad", c.orderId, order.paymentSessionId!), "whsec_wrong"));
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe("PENDING_PAYMENT");
  });

  it("confirms the order once even when events are duplicated or retried", async () => {
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, "http://x");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
    const ev = completedEvent("evt_1", c.orderId, order.paymentSessionId!);
    const responses = await Promise.all([POST(signedRequest(ev)), POST(signedRequest(ev)), POST(signedRequest({ ...ev, id: "evt_2" }))]);
    for (const r of responses) expect(r.status).toBe(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.paymentStatus).toBe("PAID");
    expect(after.paymentIntentId).toBe("pi_webhook_1");
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.emailLog.count({ where: { kind: "confirmation" } })).toBe(1);
  });

  it("does not confirm unpaid sessions; expired sessions release capacity", async () => {
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const c = await createCheckout({ items: [{ menuItemId: m.quesa.id, quantity: 1 }], ...customer() }, "http://x");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } });
    await POST(signedRequest(completedEvent("evt_u", c.orderId, order.paymentSessionId!, false)));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe("PENDING_PAYMENT");
    const expired = { ...completedEvent("evt_x", c.orderId, order.paymentSessionId!, false), type: "checkout.session.expired" };
    await POST(signedRequest(expired));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe("EXPIRED");
  });
});

describe("roles and permissions", () => {
  it("matches the owner / manager / kitchen policy", () => {
    expect(Object.keys(PERMISSIONS).every((p) => can("OWNER", p as keyof typeof PERMISSIONS))).toBe(true);
    expect(can("MANAGER", "orders.manage")).toBe(true);
    expect(can("MANAGER", "menu.availability")).toBe(true);
    expect(can("MANAGER", "schedule.manage")).toBe(true);
    expect(can("MANAGER", "production.view")).toBe(true);
    expect(can("MANAGER", "menu.edit")).toBe(false);
    expect(can("MANAGER", "refunds.process")).toBe(false);
    expect(can("MANAGER", "sales.view")).toBe(false);
    expect(can("MANAGER", "users.manage")).toBe(false);
    expect(can("KITCHEN", "kitchen.view")).toBe(true);
    expect(can("KITCHEN", "production.view")).toBe(true);
    for (const p of ["orders.manage", "menu.availability", "menu.edit", "schedule.manage", "refunds.process", "sales.view", "users.manage", "business.manage"] as const)
      expect(can("KITCHEN", p)).toBe(false);
  });

  async function loginAs(role: "OWNER" | "MANAGER" | "KITCHEN", active = true) {
    const u = await prisma.user.create({ data: { email: `${role.toLowerCase()}@x.com`, name: role, role, passwordHash: "x", active } });
    cookieJar.set("aat_session", await signSession({ sub: u.id, role, name: role }));
    return u;
  }

  it("blocks anonymous access to staff APIs", async () => {
    const kitchen = await import("@/app/api/staff/kitchen/route");
    expect((await kitchen.GET(new Request("http://localhost/api/staff/kitchen"))).status).toBe(401);
    cookieJar.set("aat_session", "forged.token.value");
    expect((await kitchen.GET(new Request("http://localhost/api/staff/kitchen"))).status).toBe(401);
  });

  it("kitchen staff can view the board but not sales, users, refunds or prices", async () => {
    await loginAs("KITCHEN");
    const kitchen = await import("@/app/api/staff/kitchen/route");
    const sales = await import("@/app/api/staff/sales/route");
    const users = await import("@/app/api/staff/users/route");
    const menuItem = await import("@/app/api/staff/menu/[id]/route");
    expect((await kitchen.GET(new Request("http://localhost/api/staff/kitchen"))).status).toBe(200);
    expect((await sales.GET(new Request("http://localhost/api/staff/sales"))).status).toBe(403);
    expect((await users.GET()).status).toBe(403);
    const patch = new Request("http://localhost/api/staff/menu/x", { method: "PATCH", body: JSON.stringify({ priceCents: 1 }) });
    expect((await menuItem.PATCH(patch, { params: Promise.resolve({ id: m.quesa.id }) })).status).toBe(403);
  });

  it("managers can mark items sold out but not change prices", async () => {
    await loginAs("MANAGER");
    const menuItem = await import("@/app/api/staff/menu/[id]/route");
    const ctx = { params: Promise.resolve({ id: m.quesa.id }) };
    const ok = await menuItem.PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ soldOut: true }) }), ctx);
    expect(ok.status).toBe(200);
    const denied = await menuItem.PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: 100 }) }), ctx);
    expect(denied.status).toBe(403);
    expect((await prisma.menuItem.findUniqueOrThrow({ where: { id: m.quesa.id } })).priceCents).toBe(2200);
  });

  it("deactivated users lose access immediately", async () => {
    await loginAs("OWNER", false);
    const kitchen = await import("@/app/api/staff/kitchen/route");
    expect((await kitchen.GET(new Request("http://localhost/api/staff/kitchen"))).status).toBe(401);
  });

  it("cross-site requests to staff APIs are rejected", async () => {
    await loginAs("OWNER");
    const menuItem = await import("@/app/api/staff/menu/[id]/route");
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      headers: { origin: "https://evil.example", host: "localhost" },
      body: JSON.stringify({ soldOut: true }),
    });
    expect((await menuItem.PATCH(req, { params: Promise.resolve({ id: m.quesa.id }) })).status).toBe(403);
  });

  it("login rejects wrong passwords", async () => {
    const { hashPassword } = await import("@/lib/auth");
    await prisma.user.create({ data: { email: "o@x.com", name: "O", role: "OWNER", passwordHash: await hashPassword("correct-horse-battery") } });
    const login = await import("@/app/api/staff/login/route");
    const bad = await login.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ email: "o@x.com", password: "nope" }) }));
    expect(bad.status).toBe(401);
    const good = await login.POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ email: "o@x.com", password: "correct-horse-battery" }) }),
    );
    expect(good.status).toBe(200);
    expect(cookieJar.has("aat_session")).toBe(true);
  });
});
