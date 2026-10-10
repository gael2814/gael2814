import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-talavera flex min-h-screen items-center justify-center px-4 text-center">
      <div className="rounded-3xl border-4 border-mustard bg-cream-light p-8 shadow-stamp">
        <h1 className="font-display text-4xl text-forest">¡Ay ay ay!</h1>
        <p className="mt-2">We couldn&apos;t find that page.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-terracotta px-6 py-2 font-display text-cream">Go home</Link>
      </div>
    </main>
  );
}
