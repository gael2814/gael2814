import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicOrder } from "@/lib/public-order";
import { getSettings } from "@/lib/settings";
import { imageUrl } from "@/lib/menu";
import { formatCentsExact } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import { SiteHeader } from "@/components/SiteHeader";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order Status", robots: { index: false } };

const STEPS = [
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY", label: "Ready for pickup" },
  { key: "PICKED_UP", label: "Picked up" },
];

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [order, settings] = await Promise.all([getPublicOrder(token), getSettings()]);
  if (!order) notFound();
  const b = settings.business;
  const stepIdx = STEPS.findIndex((s) => s.key === order.status);
  const final = ["PICKED_UP", "CANCELLED", "EXPIRED"].includes(order.status);

  return (
    <>
      <SiteHeader logoUrl={imageUrl(b.logoImageId)} />
      {!final && <AutoRefresh seconds={order.status === "PENDING_PAYMENT" ? 4 : 20} />}
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-xl rounded-3xl border-4 border-forest bg-cream-light p-6 shadow-stamp">
          {order.status === "PENDING_PAYMENT" ? (
            <div className="text-center" role="status">
              <h1 className="font-display text-2xl text-forest">Confirming your payment…</h1>
              <p className="mt-2 text-sm">This usually takes a few seconds. This page updates automatically.</p>
            </div>
          ) : order.status === "EXPIRED" ? (
            <div className="text-center">
              <h1 className="font-display text-2xl text-terracotta">Payment not completed</h1>
              <p className="mt-2">This order was not paid, so it was not sent to our kitchen. You have not been charged.</p>
              <Link href="/order" className="mt-4 inline-block rounded-full bg-terracotta px-6 py-2 font-display text-cream">Start a new order</Link>
            </div>
          ) : order.status === "CANCELLED" ? (
            <div className="text-center">
              <h1 className="font-display text-2xl text-terracotta">Order #{order.number} was cancelled</h1>
              {order.refundedCents > 0 && <p className="mt-2">A refund of {formatCentsExact(order.refundedCents)} was issued to your original payment method.</p>}
            </div>
          ) : (
            <>
              <p className="text-center font-serif text-xl font-bold italic text-terracotta">¡Gracias, {order.firstName}!</p>
              <h1 className="text-center font-display text-4xl text-forest">Order #{order.number}</h1>
              <div className="mt-4 rounded-2xl bg-forest p-4 text-center text-cream">
                <div className="text-xs uppercase tracking-widest text-mustard">{order.status === "READY" ? "Ready now!" : "Estimated pickup"}</div>
                <div className="font-display text-4xl">{formatTime(new Date(order.pickupAt))}</div>
                <div className="text-sm">{formatDate(order.serviceDate)}</div>
              </div>
              <ol className="mt-6 grid grid-cols-4 gap-1 text-center text-xs font-semibold" aria-label="Order progress">
                {STEPS.map((s, i) => (
                  <li key={s.key} aria-current={i === stepIdx ? "step" : undefined}>
                    <div className={`mx-auto mb-1 h-3 rounded-full ${i <= stepIdx ? "bg-terracotta" : "bg-forest/15"}`} />
                    <span className={i === stepIdx ? "text-terracotta" : "text-ink/60"}>{s.label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-center font-semibold">Please give us your order number when picking up.</p>
            </>
          )}

          <ul className="mt-6 divide-y divide-forest/15 border-t-2 border-forest">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between py-2">
                <span>{i.quantity} × {i.name}</span>
                <span>{formatCentsExact(i.unitCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t-2 border-forest pt-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCentsExact(order.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt>Sales tax</dt><dd>{formatCentsExact(order.taxCents)}</dd></div>
            <div className="flex justify-between font-display text-lg text-forest"><dt>Total</dt><dd>{formatCentsExact(order.totalCents)}</dd></div>
          </dl>
          {order.notes && <p className="mt-3 text-sm"><strong>Notes:</strong> {order.notes}</p>}

          <div className="mt-6 rounded-xl bg-mustard/30 p-3 text-sm">
            <strong>Pickup location:</strong> {b.addressLine1}, {b.city}, {b.state}
            {b.phone && <> · <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="underline">{b.phone}</a></>}
          </div>
        </div>
      </main>
    </>
  );
}
