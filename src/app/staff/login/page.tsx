import { LoginForm } from "./LoginForm";

export const metadata = { title: "Staff Sign In", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/staff") ? next : "/staff/kitchen";
  return (
    <main className="flex min-h-screen bg-forest items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border-4 border-mustard bg-cream-light p-6 shadow-stamp">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Ay Ay Tacos" className="mx-auto h-28 w-auto" />
        <h1 className="mt-1 text-center font-display text-lg uppercase tracking-wide text-forest">Staff sign in</h1>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
