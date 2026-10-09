"use client";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/staff/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (r.ok) {
      window.location.href = next;
      return;
    }
    setError((await r.json().catch(() => ({}))).error ?? "Sign in failed");
    setBusy(false);
  }
  const input = "mt-1 w-full rounded-xl border-2 border-forest/40 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label className="block text-sm font-semibold">Email<input className={input} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block text-sm font-semibold">Password<input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="rounded-lg bg-terracotta p-2 text-sm font-semibold text-cream" role="alert">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-forest py-3 font-display uppercase tracking-wide text-cream hover:bg-forest-light disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
