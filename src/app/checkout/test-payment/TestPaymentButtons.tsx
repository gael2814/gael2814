"use client";
import { useState } from "react";

export function TestPaymentButtons({ session }: { session: string }) {
  const [busy, setBusy] = useState(false);
  async function go(outcome: "pay" | "fail" | "cancel") {
    setBusy(true);
    const r = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session, outcome }) });
    const d = await r.json();
    window.location.href = outcome === "cancel" ? `/order/cancelled?token=${d.token}` : `/order/status/${d.token}`;
  }
  return (
    <div className="mt-6 space-y-2">
      <button disabled={busy} onClick={() => go("pay")} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50">Pay (test success)</button>
      <button disabled={busy} onClick={() => go("fail")} className="w-full rounded-lg bg-slate-200 py-3 font-semibold disabled:opacity-50">Simulate declined card</button>
      <button disabled={busy} onClick={() => go("cancel")} className="w-full py-2 text-sm text-slate-500 underline">Cancel and go back</button>
    </div>
  );
}
