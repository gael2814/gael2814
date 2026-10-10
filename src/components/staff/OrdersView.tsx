"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtTime, money } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

type Row = {
  id: string; number: number; serviceDate: string; pickupAt: string; customerName: string; customerPhone: string; customerEmail: string;
  status: string; paymentStatus: string; totalCents: number; refundedCents: number; itemCount: number; summary: string;
};
type Detail = Row & {
  subtotalCents: number; taxCents: number; tipCents: number; notes: string | null; paidAt: string | null; paymentIntentId: string | null; cancelReason: string | null;
  items: { id: string; name: string; quantity: number; unitCents: number }[];
  events: { id: string; type: string; message: string; actor: string | null; createdAt: string }[];
  emails: { id: string; subject: string; status: string; to: string; createdAt: string; error: string | null }[];
};

export function OrdersView({ canRefund, today }: { canRefund: boolean; today: string }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [unpaid, setUnpaid] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sel, setSel] = useState<Detail | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [slots, setSlots] = useState<number[]>([]);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ from, to, ...(q ? { q } : {}), ...(unpaid ? { includeUnpaid: "1" } : {}) });
    setRows(await api<Row[]>(`/api/staff/orders?${p}`));
  }, [from, to, q, unpaid]);
  useEffect(() => {
    load().catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [load]);

  async function open(id: string) {
    const d = await api<Detail>(`/api/staff/orders/${id}`);
    setSel(d);
    const k = await api<{ slotOptions: number[] }>(`/api/staff/kitchen?date=${d.serviceDate}`);
    setSlots(k.slotOptions);
  }
  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      if (sel) await open(sel.id);
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  const totals = rows?.filter((r) => !["UNPAID"].includes(r.paymentStatus) && r.status !== "CANCELLED");
  return (
    <div>
      <PageTitle>Orders</PageTitle>
      <Card className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">From<input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm font-semibold">To<input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="min-w-[200px] flex-1 text-sm font-semibold">Search<input className={inputCls} placeholder="Name, phone, email or #order" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unpaid} onChange={(e) => setUnpaid(e.target.checked)} /> Show unpaid/abandoned</label>
      </Card>
      {msg && <div className="mb-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card className="overflow-x-auto bg-white p-0">
          <table className="w-full text-sm">
            <thead className="bg-forest text-left text-cream">
              <tr><th className="p-2">#</th><th>Date / pickup</th><th>Customer</th><th>Items</th><th>Status</th><th className="pr-2 text-right">Total</th></tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id} onClick={() => open(r.id)} className={`cursor-pointer border-b border-forest/10 hover:bg-mustard/20 ${sel?.id === r.id ? "bg-mustard/30" : ""}`}>
                  <td className="p-2 font-bold">{r.number}</td>
                  <td>{r.serviceDate}<div className="text-xs text-ink/60">{fmtTime(r.pickupAt)}</div></td>
                  <td>{r.customerName}<div className="text-xs text-ink/60">{r.customerPhone}</div></td>
                  <td className="max-w-[220px] truncate" title={r.summary}>{r.summary}</td>
                  <td><span className="text-xs font-bold">{r.status.replace("_", " ")}</span><div className="text-xs text-ink/60">{r.paymentStatus.replace("_", " ")}</div></td>
                  <td className="pr-2 text-right">{money(r.totalCents)}{r.refundedCents > 0 && <div className="text-xs text-terracotta">−{money(r.refundedCents)}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows && rows.length === 0 && <p className="p-6 text-center text-ink/60">No orders found.</p>}
          {totals && totals.length > 0 && (
            <p className="border-t-2 border-forest p-2 text-right text-sm font-bold">
              {totals.length} active paid orders · {money(totals.reduce((s, r) => s + r.totalCents - r.refundedCents, 0))}
            </p>
          )}
        </Card>

        <div>
          {!sel ? (
            <Card className="text-center text-ink/60">Select an order to see details.</Card>
          ) : (
            <Card className="space-y-3 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-3xl text-forest">#{sel.number}</div>
                  <div className="text-sm">{sel.serviceDate} · pickup {fmtTime(sel.pickupAt)}</div>
                </div>
                <div className="text-right text-xs font-bold">{sel.status}<br />{sel.paymentStatus}</div>
              </div>
              <div className="text-sm">
                <strong>{sel.customerName}</strong><br />
                <a className="underline" href={`tel:${sel.customerPhone}`}>{sel.customerPhone}</a> · <a className="underline" href={`mailto:${sel.customerEmail}`}>{sel.customerEmail}</a>
              </div>
              <ul className="border-y border-forest/20 py-2 text-sm">
                {sel.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{money(i.unitCents * i.quantity)}</span></li>)}
                <li className="flex justify-between text-ink/70"><span>Subtotal</span><span>{money(sel.subtotalCents)}</span></li>
                <li className="flex justify-between text-ink/70"><span>Tax</span><span>{money(sel.taxCents)}</span></li>
                {sel.tipCents > 0 && <li className="flex justify-between text-ink/70"><span>Tip (tip pool)</span><span>{money(sel.tipCents)}</span></li>}
                <li className="flex justify-between font-bold"><span>Total</span><span>{money(sel.totalCents)}</span></li>
                {sel.refundedCents > 0 && <li className="flex justify-between text-terracotta"><span>Refunded</span><span>−{money(sel.refundedCents)}</span></li>}
              </ul>
              {sel.notes && <p className="rounded bg-mustard/30 p-2 text-sm"><strong>Notes:</strong> {sel.notes}</p>}

              {["CONFIRMED", "PREPARING", "READY"].includes(sel.status) && (
                <label className="block text-sm font-semibold">
                  Change pickup time (emails the customer)
                  <select
                    className={inputCls}
                    value={new Date(sel.pickupAt).getTime()}
                    onChange={(e) => act(() => api(`/api/staff/orders/${sel.id}/pickup`, { body: { pickupAt: Number(e.target.value), notify: true } }), "Pickup time updated and customer emailed.")}
                  >
                    {slots.map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                {sel.paymentStatus !== "UNPAID" && (
                  <Btn variant="ghost" onClick={() => act(() => api(`/api/staff/orders/${sel.id}/resend`, { body: {} }), "Confirmation email re-sent.")}>Resend confirmation</Btn>
                )}
                {["CONFIRMED", "PREPARING", "READY"].includes(sel.status) && (
                  <Btn
                    variant="danger"
                    onClick={() => {
                      const reason = prompt("Reason for cancelling (optional):");
                      if (reason === null) return;
                      const refund = canRefund && confirm(`Also refund the remaining ${money(sel.totalCents - sel.refundedCents)}?`);
                      act(() => api(`/api/staff/orders/${sel.id}/cancel`, { body: { reason, refund } }), "Order cancelled.");
                    }}
                  >
                    Cancel order
                  </Btn>
                )}
                {canRefund && ["PAID", "PARTIALLY_REFUNDED"].includes(sel.paymentStatus) && (
                  <Btn
                    variant="secondary"
                    onClick={() => {
                      const max = (sel.totalCents - sel.refundedCents) / 100;
                      const v = prompt(`Refund amount in dollars (max ${max.toFixed(2)}):`, max.toFixed(2));
                      if (!v) return;
                      const cents = Math.round(Number(v) * 100);
                      if (!cents || cents < 1) return alert("Enter a valid amount");
                      act(() => api(`/api/staff/orders/${sel.id}/refund`, { body: { amountCents: cents } }), "Refund processed.");
                    }}
                  >
                    Refund…
                  </Btn>
                )}
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold">History & emails</summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {sel.events.map((e) => (
                    <li key={e.id}>{new Date(e.createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })} — {e.message}{e.actor ? ` (${e.actor})` : ""}</li>
                  ))}
                  {sel.emails.map((e) => (
                    <li key={e.id} className={e.status === "failed" ? "text-terracotta" : ""}>
                      ✉ {e.subject} → {e.to}: <strong>{e.status}</strong>{e.error ? ` (${e.error})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
