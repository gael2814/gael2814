"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmtTime, money } from "./api";
import { Btn, Notice, PageTitle } from "./ui";

type KOrder = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  pickupAt: string;
  status: "CONFIRMED" | "PREPARING" | "READY" | "PICKED_UP" | "CANCELLED";
  paymentStatus: string;
  notes: string | null;
  totalCents: number;
  warnings: string[];
  items: { name: string; quantity: number; tacos: number }[];
};
type Board = {
  serviceDate: string;
  now: string;
  dueSoonMinutes: number;
  pendingPayments: number;
  slotOptions: number[];
  slots: { at: number; units: number; orders: number; cumulative: number; capacity: number }[];
  orders: KOrder[];
};

const STATUS: Record<KOrder["status"], { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmed", cls: "bg-mustard text-forest" },
  PREPARING: { label: "Preparing", cls: "bg-terracotta text-cream" },
  READY: { label: "Ready for Pickup", cls: "bg-green-600 text-white" },
  PICKED_UP: { label: "Picked Up", cls: "bg-ink/20 text-ink" },
  CANCELLED: { label: "Cancelled", cls: "bg-ink text-cream" },
};
const FLOW: KOrder["status"][] = ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"];
const FILTERS = [
  { key: "active", label: "To do", match: (o: KOrder) => o.status === "CONFIRMED" || o.status === "PREPARING" },
  { key: "ready", label: "Ready", match: (o: KOrder) => o.status === "READY" },
  { key: "done", label: "Picked up", match: (o: KOrder) => o.status === "PICKED_UP" },
  { key: "cancelled", label: "Cancelled", match: (o: KOrder) => o.status === "CANCELLED" },
  { key: "all", label: "All", match: () => true },
] as const;

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {}
}

export function KitchenBoard({ canManage, canRefund, today }: { canManage: boolean; canRefund: boolean; today: string }) {
  const [date, setDate] = useState(today);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("active");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const b = await api<Board>(`/api/staff/kitchen?date=${date}`);
      const ids = new Set(b.orders.map((o) => o.id));
      if (known.current) {
        const added = [...ids].filter((id) => !known.current!.has(id));
        if (added.length) {
          setFresh((f) => new Set([...f, ...added]));
          if (sound) chime();
          setTimeout(() => setFresh((f) => new Set([...f].filter((x) => !added.includes(x)))), 60_000);
        }
      }
      known.current = ids;
      setBoard(b);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection problem");
    }
  }, [date, sound]);

  useEffect(() => {
    known.current = null;
    load();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(load, 5000); // live updates without refreshing the page
    const c = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const f = FILTERS.find((x) => x.key === filter)!;
  const orders = board?.orders.filter(f.match) ?? [];
  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, board?.orders.filter(x.match).length ?? 0]));
  const dueMs = (board?.dueSoonMinutes ?? 10) * 60_000;

  return (
    <div>
      <PageTitle
        actions={
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border-2 border-forest/30 px-2 py-1 text-sm" aria-label="Service date" />
            <Btn variant={sound ? "secondary" : "ghost"} onClick={() => { setSound(!sound); if (!sound) chime(); }}>
              {sound ? "🔔 Sound on" : "🔕 Sound off"}
            </Btn>
          </>
        }
      >
        Kitchen Orders
      </PageTitle>
      {error && <Notice kind="error">{error} — retrying…</Notice>}

      {board && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {FILTERS.map((x) => (
            <button
              key={x.key}
              onClick={() => setFilter(x.key)}
              className={`rounded-full px-4 py-2 font-bold ${filter === x.key ? "bg-forest text-cream" : "bg-cream-dark text-forest"}`}
            >
              {x.label} <span className="ml-1 rounded-full bg-cream/30 px-1.5">{counts[x.key]}</span>
            </button>
          ))}
          <span className="ml-auto text-xs text-ink/60">
            Live · updates every 5s{board.pendingPayments > 0 ? ` · ${board.pendingPayments} customer(s) paying now` : ""}
          </span>
        </div>
      )}

      {!board ? (
        <p className="animate-pulse">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-forest/30 p-10 text-center text-ink/60">No orders here.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => {
            const t = new Date(o.pickupAt).getTime();
            const open = o.status === "CONFIRMED" || o.status === "PREPARING";
            const late = open && now > t;
            const soon = open && !late && t - now <= dueMs;
            const idx = FLOW.indexOf(o.status);
            return (
              <article
                key={o.id}
                className={`flex flex-col rounded-2xl border-4 bg-white p-3 shadow ${
                  late ? "animate-[pulse_2s_ease-in-out_infinite] border-terracotta" : soon ? "border-mustard" : "border-forest/20"
                } ${o.status === "CANCELLED" ? "opacity-60" : ""}`}
                aria-label={`Order ${o.number}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-3xl leading-none text-forest">#{o.number}</div>
                    <div className="mt-1 font-semibold">{o.customerName}</div>
                    <a href={`tel:${o.customerPhone}`} className="text-sm text-ink/70 underline">{o.customerPhone}</a>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-2xl ${late ? "text-terracotta" : "text-forest"}`}>{fmtTime(o.pickupAt)}</div>
                    {late && <div className="text-xs font-bold uppercase text-terracotta">Running late</div>}
                    {soon && <div className="text-xs font-bold uppercase text-mustard-dark">Due soon</div>}
                    {fresh.has(o.id) && <div className="mt-1 inline-block rounded bg-terracotta px-2 text-xs font-bold text-cream">NEW</div>}
                  </div>
                </div>

                <ul className="mt-3 space-y-1 border-t-2 border-forest/10 pt-2">
                  {o.items.map((i, k) => (
                    <li key={k} className="flex gap-2 text-lg">
                      <span className="min-w-[2.5rem] rounded bg-forest px-1.5 text-center font-display text-cream">{i.quantity}×</span>
                      <span className="font-semibold leading-tight">
                        {i.name}
                        {i.tacos > 0 && <span className="ml-1 text-sm font-normal text-ink/60">({i.tacos} tacos)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="mt-2 rounded-lg bg-mustard/30 p-2 text-sm"><strong>Note:</strong> {o.notes}</p>}
                {o.warnings.map((w, k) => <p key={k} className="mt-2 rounded-lg bg-terracotta/15 p-2 text-xs font-semibold text-terracotta-dark">⚠ {w}</p>)}

                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-800">{o.paymentStatus.replace("_", " ")} · {money(o.totalCents)}</span>
                </div>

                {o.status !== "CANCELLED" && (
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    {FLOW.map((s, i) => (
                      <button
                        key={s}
                        disabled={busy === o.id}
                        onClick={() => act(o.id, () => api(`/api/staff/orders/${o.id}/status`, { body: { status: s } }))}
                        className={`rounded-lg px-1 py-3 text-xs font-bold leading-tight ${
                          o.status === s ? STATUS[s].cls + " ring-2 ring-forest" : i === idx + 1 ? "bg-forest text-cream" : "bg-cream-dark text-forest"
                        }`}
                        aria-pressed={o.status === s}
                      >
                        {STATUS[s].label}
                      </button>
                    ))}
                  </div>
                )}

                {canManage && o.status !== "CANCELLED" && o.status !== "PICKED_UP" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-2 text-xs">
                    <label className="flex items-center gap-1">
                      Pickup
                      <select
                        className="rounded border border-forest/30 px-1 py-1"
                        value={t}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (confirm(`Change pickup for #${o.number} to ${fmtTime(v)}? The customer will be emailed.`))
                            act(o.id, () => api(`/api/staff/orders/${o.id}/pickup`, { body: { pickupAt: v, notify: true } }));
                        }}
                      >
                        {board.slotOptions.map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}
                      </select>
                    </label>
                    <button
                      className="ml-auto rounded px-2 py-1 font-bold text-terracotta underline"
                      onClick={() => {
                        const reason = prompt(`Cancel order #${o.number}? Enter a reason (optional):`);
                        if (reason === null) return;
                        const refund = canRefund && confirm(`Refund the full ${money(o.totalCents)} to the customer's card?`);
                        act(o.id, () => api(`/api/staff/orders/${o.id}/cancel`, { body: { reason, refund } }));
                      }}
                    >
                      Cancel order
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {board && (
        <details className="mt-6">
          <summary className="cursor-pointer font-semibold text-forest">Kitchen load by pickup time</summary>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
            {board.slots.map((s) => {
              const pct = s.capacity ? Math.min(100, (s.cumulative / s.capacity) * 100) : 0;
              return (
                <div key={s.at} className="rounded-lg bg-white p-2 text-center text-xs">
                  <div className="font-bold">{fmtTime(s.at)}</div>
                  <div>{s.orders} orders</div>
                  <div className="mt-1 h-2 rounded bg-forest/10"><div className={`h-2 rounded ${pct >= 100 ? "bg-terracotta" : "bg-forest"}`} style={{ width: `${pct}%` }} /></div>
                  <div className="text-ink/60">{Math.round(pct)}% booked</div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
