"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 text-center">
      <div className="rounded-3xl border-4 border-forest bg-cream-light p-8">
        <h1 className="font-display text-3xl text-forest">Something went wrong</h1>
        <p className="mt-2">Please try again. If it keeps happening, give us a call.</p>
        <button onClick={reset} className="mt-4 rounded-full bg-terracotta px-6 py-2 font-display text-cream">Try again</button>
      </div>
    </main>
  );
}
