import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { mockPaymentsAllowed } from "@/lib/payments";
import { formatCentsExact } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { TestPaymentButtons } from "./TestPaymentButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test Payment", robots: { index: false } };

/** Stand-in for Stripe Checkout while Stripe keys are not configured. Never available in production. */
export default async function TestPayment({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  if (!mockPaymentsAllowed()) notFound();
  const { session } = await searchParams;
  const order = session ? await prisma.order.findUnique({ where: { paymentSessionId: session }, include: { items: true } }) : null;
  if (!order) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-900">
          TEST MODE — Stripe is not connected yet. No real payment is taken.
        </div>
        <h1 className="mt-4 text-xl font-bold">Ay Ay Tacos · Order #{order.number}</h1>
        <ul className="mt-3 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{formatCentsExact(i.unitCents * i.quantity)}</span></li>
          ))}
          <li className="flex justify-between text-slate-500"><span>Sales tax</span><span>{formatCentsExact(order.taxCents)}</span></li>
        </ul>
        <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{formatCentsExact(order.totalCents)}</span></div>
        <p className="mt-2 text-sm text-slate-600">Estimated pickup: {formatTime(order.pickupAt)}</p>
        <TestPaymentButtons session={session!} />
      </div>
    </main>
  );
}
