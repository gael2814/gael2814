"use client";
import { useCallback, useEffect, useState } from "react";
import type { SalesReport } from "@/lib/reports/sales";
import { api, money } from "./api";
import { Card, inputCls, PageTitle } from "./ui";

function Bars({ rows, label }: { rows: { label: string; value: number; sub?: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-ink/60">No data yet.</p>;
  return (
    <ul className="space-y-1.5" aria-label={label}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(90px,170px)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate font-semibold">{r.label}</span>
          <span className="h-4 rounded bg-forest/10">
            <span className="block h-4 rounded bg-terracotta" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.sub}</span>
        </li>
      ))}
    </ul>
  );
}

export function SalesView() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);

  const load = useCallback(async () => {
    const q = range ? `?from=${range.from}&to=${range.to}` : "";
    const d = await api<{ from: string; to: string; report: SalesReport }>(`/api/staff/sales${q}`);
    setReport(d.report);
    if (!range) setRange({ from: d.from, to: d.to });
  }, [range]);
  useEffect(() => {
    load();
  }, [load]);

  const stat = (label: string, value: string, hint?: string) => (
    <Card className="bg-white">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/60">{label}</div>
      <div className="font-display text-2xl text-forest">{value}</div>
      {hint && <div className="text-xs text-ink/60">{hint}</div>}
    </Card>
  );

  return (
    <div>
      <PageTitle
        actions={
          range && (
            <>
              <input type="date" className={`${inputCls} w-40`} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
              <span>to</span>
              <input type="date" className={`${inputCls} w-40`} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
            </>
          )
        }
      >
        Sales & Analytics
      </PageTitle>
      {!report ? (
        <p className="animate-pulse">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stat("Preorder revenue", money(report.netCents), "Food + tax, minus refunds (tips not included)")}
            {stat("Orders", String(report.orders), "Paid, not cancelled")}
            {stat("Average order", money(report.averageOrderCents))}
            {stat("Items sold", String(report.itemsSold))}
            {stat("Sales before tax", money(report.netSalesExTaxCents))}
            {stat("Sales tax collected", money(report.taxCents))}
            {stat("Cancelled orders", String(report.cancelledOrders))}
            {stat("Refunds", money(report.refundsCents), `${report.refundedOrders} orders`)}
            {stat("Tips for the team", money(report.tipsCents), "Tip pool, shared by the whole crew")}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg text-forest">Best-selling dishes</h2>
              <p className="mb-2 text-xs text-ink/60">Use this to plan how much to prep.</p>
              <Bars label="Best sellers" rows={report.bestSellers.slice(0, 12).map((b) => ({ label: b.name, value: b.quantity, sub: `${b.quantity} · ${money(b.revenueCents)}` }))} />
            </Card>
            <Card>
              <h2 className="font-display text-lg text-forest">Orders by pickup time</h2>
              <p className="mb-2 text-xs text-ink/60">Shows your busiest pickup windows.</p>
              <Bars label="By pickup time" rows={report.byPickupTime.map((s) => ({ label: s.label, value: s.orders, sub: `${s.orders} · ${money(s.revenueCents)}` }))} />
            </Card>
            <Card>
              <h2 className="font-display text-lg text-forest">Daily sales</h2>
              <Bars label="Daily" rows={report.daily.map((d) => ({ label: d.date.slice(5), value: d.revenueCents, sub: `${d.orders} · ${money(d.revenueCents)}${d.tipsCents ? ` · tips ${money(d.tipsCents)}` : ""}` }))} />
            </Card>
            <Card>
              <h2 className="font-display text-lg text-forest">Weekly sales</h2>
              <Bars label="Weekly" rows={report.weekly.map((w) => ({ label: `Wk ${w.weekStart.slice(5)}`, value: w.revenueCents, sub: `${w.orders} · ${money(w.revenueCents)}` }))} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
