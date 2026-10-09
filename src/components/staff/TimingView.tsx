"use client";
import { useCallback, useEffect, useState } from "react";
import type { PerformanceReport } from "@/lib/reports/performance";
import { api } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

const vs = (m: number | null) => (m == null ? "—" : m <= 0 ? `${Math.abs(m)} min early` : `${m} min late`);

export function TimingView() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [r, setR] = useState<PerformanceReport | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const q = range ? `?from=${range.from}&to=${range.to}` : "";
    const d = await api<{ from: string; to: string; report: PerformanceReport }>(`/api/staff/performance${q}`);
    setR(d.report);
    if (!range) setRange({ from: d.from, to: d.to });
  }, [range]);
  useEffect(() => {
    load().catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [load]);

  async function apply(n: number) {
    if (!confirm(`Change kitchen capacity to ${n} orders per 15 minutes? New pickup estimates will use this right away.`)) return;
    try {
      await api("/api/staff/settings", { method: "PATCH", body: { key: "kitchen", value: { capacityUnitsPerSlot: n } } });
      setMsg({ kind: "ok", text: `Kitchen capacity set to ${n} orders per 15 minutes.` });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  const tile = (label: string, value: string, hint?: string) => (
    <Card className="bg-white">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/60">{label}</div>
      <div className="font-display text-2xl text-forest">{value}</div>
      {hint && <div className="text-xs text-ink/60">{hint}</div>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          range && (
            <>
              <input type="date" className={`${inputCls} !w-40`} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
              <span>to</span>
              <input type="date" className={`${inputCls} !w-40`} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
            </>
          )
        }
      >
        Pickup Time Accuracy
      </PageTitle>
      <p className="text-sm text-ink/70">
        Every time the kitchen taps <strong>Ready for Pickup</strong>, the time is saved and compared with the pickup time we promised the customer.
        Tap Ready the moment each order is bagged so these numbers stay accurate.
      </p>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      {!r ? (
        <p className="animate-pulse">Loading…</p>
      ) : r.tracked === 0 ? (
        <Card>No ready times recorded yet. Once the kitchen starts tapping &quot;Ready for Pickup&quot;, results show up here.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tile("Ready on time", r.onTimePct == null ? "—" : `${r.onTimePct}%`, `${r.tracked} of ${r.orders} orders tracked`)}
            {tile("Average", vs(r.avgVsPromiseMin), "compared with promised time")}
            {tile("Late orders", String(r.late), r.avgLateMin ? `${r.avgLateMin} min late on average` : undefined)}
            {tile("Food waiting", r.avgPickupWaitMin == null ? "—" : `${r.avgPickupWaitMin} min`, "from ready to picked up")}
          </div>

          <Card className={r.pace.suggestion ? "border-4 border-mustard bg-white" : "bg-white"}>
            <h2 className="font-display text-xl text-forest">Kitchen speed</h2>
            <p className="mt-1 text-sm text-ink/70">
              Measured on busy mornings, when the first pickup times were fully booked and the kitchen was cooking flat out.
              Quiet days don&apos;t count, because orders are cooked closer to pickup on purpose.
            </p>
            <p className="mt-3 text-lg">
              Your setting: <strong>{r.pace.current} orders per 15 min</strong>
              {r.pace.median != null && (
                <>
                  {" · "}Measured: <strong>{r.pace.median} orders per 15 min</strong> ({r.pace.measuredDays} busy {r.pace.measuredDays === 1 ? "morning" : "mornings"})
                </>
              )}
            </p>
            {r.pace.suggestion != null ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="font-semibold">
                  Suggestion: change capacity to <strong>{r.pace.suggestion}</strong> orders per 15 minutes
                  {r.pace.suggestion < r.pace.current ? " so customers get realistic pickup times." : ". Your kitchen is faster than the setting."}
                </p>
                <Btn variant="secondary" onClick={() => apply(r.pace.suggestion!)}>Use {r.pace.suggestion}</Btn>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/70">
                {r.pace.measuredDays < 3
                  ? `Needs at least 3 busy mornings to make a suggestion (${r.pace.measuredDays} so far).`
                  : "Your setting matches what the kitchen really does. No change needed."}
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-x-auto bg-white">
              <h2 className="font-display text-lg text-forest">By pickup time</h2>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b-2 border-forest text-left"><th className="py-1">Pickup</th><th>Orders</th><th>On time</th><th>Average</th></tr></thead>
                <tbody>
                  {r.bySlot.map((s) => (
                    <tr key={s.label} className="border-b border-forest/10">
                      <td className="py-1.5 font-bold">{s.label}</td>
                      <td>{s.orders}</td>
                      <td className={s.onTimePct != null && s.onTimePct < 80 ? "font-bold text-terracotta" : ""}>{s.onTimePct ?? "—"}%</td>
                      <td>{vs(s.avgVsPromiseMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="overflow-x-auto bg-white">
              <h2 className="font-display text-lg text-forest">By day</h2>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b-2 border-forest text-left"><th className="py-1">Date</th><th>Tracked</th><th>On time</th><th>Last ready</th><th>Speed</th></tr></thead>
                <tbody>
                  {r.byDay.map((d) => (
                    <tr key={d.date} className="border-b border-forest/10">
                      <td className="py-1.5 font-bold">{d.date}</td>
                      <td>{d.tracked}/{d.orders}</td>
                      <td className={d.onTimePct != null && d.onTimePct < 80 ? "font-bold text-terracotta" : ""}>{d.onTimePct ?? "—"}{d.onTimePct != null && "%"}</td>
                      <td>{d.lastReady ?? "—"}</td>
                      <td>{d.rushPace ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
