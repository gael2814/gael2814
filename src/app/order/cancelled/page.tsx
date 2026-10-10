import Link from "next/link";
import { ReleaseHold } from "./ReleaseHold";

export const metadata = { title: "Payment Cancelled", robots: { index: false } };

export default async function Cancelled({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="bg-talavera flex min-h-screen items-center justify-center px-4">
      {token && <ReleaseHold token={token} />}
      <div className="max-w-md rounded-3xl border-4 border-mustard bg-cream-light p-8 text-center shadow-stamp">
        <h1 className="font-display text-3xl text-forest">Payment cancelled</h1>
        <p className="mt-3">No worries — you were not charged and your order was not sent to the kitchen.</p>
        <Link href="/order" className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 font-display uppercase text-cream">Back to ordering</Link>
      </div>
    </main>
  );
}
