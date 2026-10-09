"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicCategory, PublicMenuItem } from "@/lib/menu";
import { formatCents, formatCentsExact } from "@/lib/money";
import { FoodPhoto } from "../FoodPhoto";

type Status = { open: boolean; message: string; sub: string };
type Quote = {
  lines: { menuItemId: string; name: string; unitCents: number; quantity: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRateBps: number;
  pickupOptions: number[];
};

const CART_KEY = "aat-cart-v1";
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export function OrderApp(props: {
  initialMenu: PublicCategory[];
  initialStatus: Status;
  taxRateBps: number;
  taxLabel: string;
  allergyNotice: string;
  address: string;
}) {
  const [menu, setMenu] = useState(props.initialMenu);
  const [status, setStatus] = useState(props.initialStatus);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<"menu" | "checkout">("menu");
  const [drawer, setDrawer] = useState(false);

  const items = useMemo(() => new Map(menu.flatMap((c) => c.items).map((i) => [i.id, i])), [menu]);

  // Cart is kept in the browser only until checkout; orders are stored in the database.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "{}");
      if (saved && typeof saved === "object") setCart(saved);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, loaded]);

  const refreshMenu = useCallback(async () => {
    try {
      const r = await fetch("/api/menu", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setMenu(d.menu);
      setStatus((s) => ({ ...s, open: d.preorder.open, message: d.preorder.message }));
    } catch {}
  }, []);
  useEffect(() => {
    const t = setInterval(refreshMenu, 60_000);
    return () => clearInterval(t);
  }, [refreshMenu]);

  const lines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && items.has(id))
    .map(([id, q]) => ({ item: items.get(id)!, quantity: q }));
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.item.priceCents * l.quantity, 0);

  const setQty = (id: string, q: number) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = Math.min(q, 50);
      return n;
    });

  if (step === "checkout")
    return (
      <Checkout
        lines={lines}
        onBack={() => setStep("menu")}
        onCartChange={setQty}
        onSoldOut={refreshMenu}
        allergyNotice={props.allergyNotice}
        address={props.address}
        taxLabel={props.taxLabel}
        clearCart={() => setCart({})}
      />
    );

  return (
    <main className="min-h-screen bg-cream pb-28 lg:pb-10">
      <div className={`${status.open ? "bg-forest-light" : "bg-terracotta"} text-center text-cream`}>
        <div className="mx-auto max-w-6xl px-4 py-3" role="status">
          <span className="font-display uppercase tracking-wide">{status.open ? "Preorders are open" : status.message}</span>
          <span className="block text-sm opacity-90 sm:ml-2 sm:inline">{status.sub}</span>
        </div>
      </div>

      <nav className="sticky top-[80px] z-30 border-b-2 border-forest/15 bg-cream/95 backdrop-blur" aria-label="Menu categories">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
          {menu.map((c) => (
            <a key={c.id} href={`#c-${c.slug}`} className="shrink-0 rounded-full border-2 border-forest px-3 py-1 text-sm font-semibold text-forest hover:bg-forest hover:text-cream">
              {c.name}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {!status.open && (
            <p className="rounded-xl border-2 border-terracotta bg-cream-light p-4 text-sm">
              You can browse the menu anytime. Online ordering is available during preorder hours only.
            </p>
          )}
          {menu.map((c) => (
            <section key={c.id} id={`c-${c.slug}`} className="scroll-mt-36" aria-labelledby={`h-${c.slug}`}>
              <h2 id={`h-${c.slug}`} className="font-display text-3xl text-terracotta sm:text-4xl">
                {c.name}
                {c.subtitle && <span className="block font-serif text-base font-semibold italic text-ink/60">{c.subtitle}</span>}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {c.items.map((item) => (
                  <ItemCard key={item.id} item={item} qty={cart[item.id] ?? 0} canOrder={status.open} setQty={setQty} />
                ))}
              </div>
            </section>
          ))}
          <p className="rounded-xl border-2 border-dashed border-terracotta bg-cream-light p-4 text-sm" role="note">
            <strong className="text-terracotta">Allergy information:</strong> {props.allergyNotice}
          </p>
        </div>

        {/* Desktop cart */}
        <aside className="hidden lg:block" aria-label="Your order">
          <div className="sticky top-40">
            <CartPanel lines={lines} subtotal={subtotal} setQty={setQty} canOrder={status.open} onCheckout={() => setStep("checkout")} />
          </div>
        </aside>
      </div>

      {/* Mobile cart bar + drawer */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-mustard bg-forest p-3 lg:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="flex w-full items-center justify-between rounded-full bg-terracotta px-5 py-3 font-display text-cream"
            aria-haspopup="dialog"
          >
            <span className="rounded-full bg-cream px-2 text-sm text-forest">{count}</span>
            <span className="uppercase tracking-wide">View order</span>
            <span>{formatCentsExact(subtotal)}</span>
          </button>
        </div>
      )}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden" role="dialog" aria-modal="true" aria-label="Your order" onClick={() => setDrawer(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setDrawer(false)} className="rounded-full px-3 py-1 text-sm font-semibold text-forest underline">Close</button>
            </div>
            <CartPanel
              lines={lines}
              subtotal={subtotal}
              setQty={setQty}
              canOrder={status.open}
              onCheckout={() => {
                setDrawer(false);
                setStep("checkout");
                window.scrollTo(0, 0);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function ItemCard({ item, qty, canOrder, setQty }: { item: PublicMenuItem; qty: number; canOrder: boolean; setQty: (id: string, q: number) => void }) {
  const disabled = !canOrder || item.soldOut || !item.preorderable;
  const max = item.remaining ?? 50;
  return (
    <article className={`flex gap-3 rounded-2xl border-2 border-tan/60 bg-cream-light p-3 ${item.soldOut ? "opacity-70" : ""}`}>
      <FoodPhoto src={item.imageUrl} name={item.name} size={88} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-bold leading-tight text-ink">
            {item.name}
            {item.pronunciation && <span className="block font-serif text-xs font-semibold italic text-ink/55">{item.pronunciation}</span>}
          </h3>
          <span className="font-display text-lg text-brick">{formatCents(item.priceCents)}</span>
        </div>
        {item.description && <p className="mt-1 text-[15px] leading-snug text-ink/80">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs font-bold uppercase text-terracotta">
            {item.soldOut ? "Sold out today" : !item.preorderable ? "In-store only" : item.remaining != null && item.remaining <= 10 ? `Only ${item.remaining} left` : ""}
          </span>
          {qty === 0 ? (
            <button
              disabled={disabled}
              onClick={() => setQty(item.id, 1)}
              className="rounded-full bg-terracotta px-5 py-1.5 font-display text-sm uppercase text-cream hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:bg-ink/30"
              aria-label={`Add ${item.name}`}
            >
              Add
            </button>
          ) : (
            <Stepper value={qty} max={max} onChange={(q) => setQty(item.id, q)} label={item.name} disabled={disabled} />
          )}
        </div>
      </div>
    </article>
  );
}

function Stepper({ value, onChange, label, max = 50, disabled }: { value: number; onChange: (q: number) => void; label: string; max?: number; disabled?: boolean }) {
  return (
    <div className="flex items-center rounded-full border-2 border-forest bg-cream" role="group" aria-label={`Quantity of ${label}`}>
      <button className="h-9 w-9 rounded-full font-bold text-forest hover:bg-forest/10" onClick={() => onChange(value - 1)} aria-label={`Remove one ${label}`}>
        −
      </button>
      <span className="w-7 text-center font-bold" aria-live="polite">{value}</span>
      <button
        className="h-9 w-9 rounded-full font-bold text-forest hover:bg-forest/10 disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Add one more ${label}`}
      >
        +
      </button>
    </div>
  );
}

function CartPanel({
  lines,
  subtotal,
  setQty,
  canOrder,
  onCheckout,
}: {
  lines: { item: PublicMenuItem; quantity: number }[];
  subtotal: number;
  setQty: (id: string, q: number) => void;
  canOrder: boolean;
  onCheckout: () => void;
}) {
  const blocked = lines.some((l) => l.item.soldOut || !l.item.preorderable);
  return (
    <div className="rounded-2xl border-4 border-forest bg-cream-light p-4 shadow-stamp">
      <h2 className="font-display text-2xl uppercase text-forest">Your Order</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-ink/70">Your cart is empty. Add some tacos!</p>
      ) : (
        <ul className="mt-3 divide-y divide-forest/15">
          {lines.map(({ item, quantity }) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{item.name}</div>
                <div className="text-sm text-ink/70">{formatCentsExact(item.priceCents * quantity)}</div>
                {item.soldOut && <div className="text-xs font-bold text-terracotta">Sold out — please remove</div>}
              </div>
              <Stepper value={quantity} max={item.remaining ?? 50} onChange={(q) => setQty(item.id, q)} label={item.name} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-between border-t-2 border-forest pt-3 font-display text-lg">
        <span>Subtotal</span>
        <span>{formatCentsExact(subtotal)}</span>
      </div>
      <p className="text-xs text-ink/60">Maine sales tax is added at checkout.</p>
      <button
        onClick={onCheckout}
        disabled={!canOrder || lines.length === 0 || blocked}
        className="mt-4 w-full rounded-full bg-terracotta py-3 font-display text-lg uppercase tracking-wide text-cream hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {canOrder ? "Continue to checkout" : "Preorders closed"}
      </button>
    </div>
  );
}

function Checkout({
  lines,
  onBack,
  onCartChange,
  onSoldOut,
  allergyNotice,
  address,
  taxLabel,
  clearCart,
}: {
  lines: { item: PublicMenuItem; quantity: number }[];
  onBack: () => void;
  onCartChange: (id: string, q: number) => void;
  onSoldOut: () => void;
  allergyNotice: string;
  address: string;
  taxLabel: string;
  clearCart: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<number | null>(null);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", customerEmail: "", notes: "", smsOptIn: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef<string>("");
  const cartKey = JSON.stringify(lines.map((l) => [l.item.id, l.quantity]));

  useEffect(() => {
    idem.current = crypto.randomUUID();
    let cancelled = false;
    (async () => {
      setQuoteError(null);
      if (lines.length === 0) {
        setQuote(null);
        return;
      }
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })) }),
      });
      const d = await r.json();
      if (cancelled) return;
      if (!r.ok) {
        setQuote(null);
        setQuoteError(d.error ?? "We couldn't calculate your order.");
        if (d.code === "sold_out") onSoldOut();
        return;
      }
      setQuote(d);
      setPickup((p) => (p && d.pickupOptions.includes(p) ? p : d.pickupOptions[0]));
    })().catch(() => !cancelled && setQuoteError("Network problem. Please check your connection."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || pickup == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
          requestedPickupAt: pickup,
          idempotencyKey: idem.current,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Something went wrong.");
        if (d.code === "pickup_unavailable" && d.pickupOptions) {
          setQuote((q) => (q ? { ...q, pickupOptions: d.pickupOptions } : q));
          setPickup(d.pickupOptions[0]);
          idem.current = crypto.randomUUID();
        }
        if (d.code === "sold_out") onSoldOut();
        if (d.code === "already_paid" && d.publicToken) window.location.href = `/order/status/${d.publicToken}`;
        setSubmitting(false);
        return;
      }
      clearCart();
      window.location.href = d.url;
    } catch {
      setError("Network problem. Please try again.");
      setSubmitting(false);
    }
  }

  const input = "mt-1 w-full rounded-xl border-2 border-forest/40 bg-white px-3 py-2.5 text-base focus:border-forest";

  return (
    <main className="min-h-screen bg-cream pb-16">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <button onClick={onBack} className="font-semibold text-forest underline">← Back to menu</button>
        <h1 className="mt-3 font-display text-3xl uppercase text-forest sm:text-4xl">Checkout</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
          <form onSubmit={pay} className="space-y-5 rounded-2xl border-4 border-forest bg-cream-light p-5 shadow-stamp" noValidate={false}>
            <fieldset className="space-y-3">
              <legend className="font-display text-xl text-terracotta">Your information</legend>
              <label className="block text-sm font-semibold">
                Name
                <input required autoComplete="name" className={input} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold">
                Phone
                <input required type="tel" autoComplete="tel" inputMode="tel" className={input} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={form.smsOptIn} onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })} />
                <span>
                  <strong>Text me when my order is ready.</strong> <span className="text-ink/60">One message per order. Msg &amp; data rates may apply. Reply STOP to opt out.</span>
                </span>
              </label>
              <label className="block text-sm font-semibold">
                Email <span className="font-normal text-ink/60">(for your confirmation and "order ready" notice)</span>
                <input required type="email" autoComplete="email" className={input} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold">
                Order notes <span className="font-normal text-ink/60">(optional)</span>
                <textarea maxLength={500} rows={3} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. no onions, extra consomé" />
              </label>
            </fieldset>

            <fieldset>
              <legend className="font-display text-xl text-terracotta">Pickup time</legend>
              {quoteError ? (
                <p className="mt-2 rounded-xl bg-terracotta/10 p-3 font-semibold text-terracotta-dark" role="alert">{quoteError}</p>
              ) : !quote ? (
                <p className="mt-2 animate-pulse text-sm">Checking our kitchen schedule…</p>
              ) : (
                <>
                  <div className="mt-2 rounded-2xl bg-forest p-4 text-center text-cream">
                    <div className="text-xs uppercase tracking-widest text-mustard">Estimated pickup</div>
                    <div className="font-display text-4xl">{pickup ? fmtTime(pickup) : "—"}</div>
                    <div className="text-sm opacity-90">{address}</div>
                  </div>
                  {quote.pickupOptions.length > 1 && (
                    <label className="mt-3 block text-sm font-semibold">
                      Prefer a later time?
                      <select className={input} value={pickup ?? ""} onChange={(e) => setPickup(Number(e.target.value))}>
                        {quote.pickupOptions.map((t, i) => (
                          <option key={t} value={t}>
                            {fmtTime(t)}
                            {i === 0 ? " (earliest available)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="mt-2 text-xs text-ink/70">
                    Pickup times are based on our kitchen&apos;s capacity and the orders already placed, so we can have your food hot and ready.
                  </p>
                </>
              )}
            </fieldset>

            <p className="rounded-xl border-2 border-dashed border-terracotta p-3 text-xs" role="note">
              <strong>Allergies:</strong> {allergyNotice}
            </p>

            {error && <p className="rounded-xl bg-terracotta p-3 font-semibold text-cream" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !quote || pickup == null}
              className="w-full rounded-full bg-terracotta py-4 font-display text-xl uppercase tracking-wide text-cream shadow-stamp hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:bg-ink/30"
            >
              {submitting ? "Starting secure payment…" : quote ? `Pay ${formatCentsExact(quote.totalCents)} securely` : "Pay securely"}
            </button>
            <p className="text-center text-xs text-ink/60">Secure payment by Stripe · Card, Apple Pay & Google Pay. We never see or store your card number.</p>
          </form>

          <aside className="h-fit rounded-2xl border-4 border-forest bg-cream-light p-5 shadow-stamp" aria-label="Order summary">
            <h2 className="font-display text-xl uppercase text-forest">Order summary</h2>
            <ul className="mt-3 divide-y divide-forest/15">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-ink/70">{formatCentsExact(item.priceCents)} each</div>
                  </div>
                  <Stepper value={quantity} max={item.remaining ?? 50} onChange={(q) => onCartChange(item.id, q)} label={item.name} />
                </li>
              ))}
            </ul>
            {quote && (
              <dl className="mt-3 space-y-1 border-t-2 border-forest pt-3">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCentsExact(quote.subtotalCents)}</dd></div>
                <div className="flex justify-between"><dt>{taxLabel} ({(quote.taxRateBps / 100).toFixed(2)}%)</dt><dd>{formatCentsExact(quote.taxCents)}</dd></div>
                <div className="flex justify-between font-display text-xl text-forest"><dt>Total</dt><dd>{formatCentsExact(quote.totalCents)}</dd></div>
              </dl>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
