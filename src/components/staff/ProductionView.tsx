"use client";
import { useCallback, useEffect, useState } from "react";
import type { ProductionReport } from "@/lib/reports/production";
import type { IngredientReport } from "@/lib/reports/ingredients";
import { formatAmount } from "@/lib/reports/ingredients";
import { api, fmtTime } from "./api";
import { Btn, Card, Notice, PageTitle } from "./ui";

type Snapshot = { production: ProductionReport; ingredients: IngredientReport; cutoffAt: string };
type Data = { production: ProductionReport; ingredients: IngredientReport; snapshot: Snapshot | null };

export function ProductionView({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [source, setSource] = useState<"live" | "snapshot">("live");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/staff/production?date=${date}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [date]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const view = source === "snapshot" && data?.snapshot ? data.snapshot : data;
  const p = view?.production;
  const ing = view?.ingredients;
  const dl = (type: string, format: string) => `/api/staff/production/export?date=${date}&type=${type}&format=${format}&source=${source}`;

  return (
    <div>
      <PageTitle
        actions={
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border-2 border-forest/30 px-2 py-1 text-sm" aria-label="Service date" />
            <div className="flex rounded-full bg-cream-dark p-1 text-sm font-bold">
              <button onClick={() => setSource("live")} className={`rounded-full px-3 py-1 ${source === "live" ? "bg-forest text-cream" : ""}`}>Live</button>
              <button
                onClick={() => setSource("snapshot")}
                disabled={!data?.snapshot}
                className={`rounded-full px-3 py-1 disabled:opacity-40 ${source === "snapshot" ? "bg-forest text-cream" : ""}`}
                title={data?.snapshot ? "" : "Available after preorders close"}
              >
                Cutoff snapshot
              </button>
            </div>
            <Btn variant="secondary" onClick={() => window.print()}>Print</Btn>
          </>
        }
      >
        Lunch Production
      </PageTitle>
      {error && <Notice kind="error">{error}</Notice>}
      {source === "snapshot" && data?.snapshot && (
        <Notice>Final preorder cutoff snapshot taken at {fmtTime(data.snapshot.cutoffAt)}. Switch to Live to see changes and cancellations since then.</Notice>
      )}
      {source === "live" && <p className="no-print mb-2 text-xs text-ink/60">Live — updates automatically as paid orders arrive.</p>}

      {!p || !ing ? (
        <p className="animate-pulse">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* KITCHEN PRODUCTION REPORT */}
          <section aria-labelledby="prod-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="prod-h" className="font-display text-xl uppercase text-terracotta">Kitchen Production Report</h2>
              <div className="no-print flex gap-2 text-sm">
                <a className="rounded-full border-2 border-forest px-3 py-1 font-bold text-forest" href={dl("production", "csv")}>CSV</a>
                <a className="rounded-full border-2 border-forest px-3 py-1 font-bold text-forest" href={dl("production", "pdf")}>PDF</a>
              </div>
            </div>
            <Card className="mt-2 border-4 border-forest bg-white">
              <h3 className="font-display text-2xl text-forest">LUNCH PRODUCTION SUMMARY</h3>
              <p className="text-sm text-ink/70">
                {p.totals.orders} paid orders · {p.totals.items} items · {p.totals.tacos} individual tacos · workload {p.totals.units} units
              </p>
              {p.dishes.length === 0 ? (
                <p className="mt-4 text-ink/60">No paid orders yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {p.dishes.map((d) => (
                    <li key={d.menuItemId} className="flex items-baseline gap-3 text-xl sm:text-2xl">
                      <span className="min-w-[3.5rem] text-right font-display text-terracotta">{d.quantity}</span>
                      <span className="font-semibold">
                        {d.name}
                        {d.tacos > 0 && <span className="ml-2 font-display text-forest">= {d.tacos} individual tacos</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <h3 className="font-display text-lg text-forest">By pickup time</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-forest text-left">
                        <th className="py-1 pr-2">Pickup</th><th className="pr-2">Orders</th><th className="pr-2">Workload</th><th>Dishes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.slots.map((s) => (
                        <tr key={s.at} className={`border-b border-forest/10 align-top ${s.orders ? "" : "text-ink/40"}`}>
                          <td className="py-1.5 pr-2 font-bold">{fmtTime(s.at)}</td>
                          <td className="pr-2">{s.orders}</td>
                          <td className="pr-2">
                            {s.units} / {s.capacity}
                            <div className="h-1.5 w-16 rounded bg-forest/10"><div className={`h-1.5 rounded ${s.units > s.capacity ? "bg-terracotta" : "bg-forest"}`} style={{ width: `${Math.min(100, (s.units / s.capacity) * 100)}%` }} /></div>
                          </td>
                          <td>{s.dishes.map((d) => `${d.quantity}× ${d.name}`).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ink/60">Workload: 1 unit = 1 quesabirria order. Capacity shown is per interval; the kitchen can also work ahead before 11:00.</p>
              </Card>
              <Card>
                <h3 className="font-display text-lg text-forest">Order status</h3>
                <dl className="mt-2 space-y-1">
                  {Object.entries(p.statusCounts).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><dt>{k.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</dt><dd className="font-bold">{v}</dd></div>
                  ))}
                </dl>
                {p.cancelled.orders > 0 && (
                  <p className="mt-3 rounded-lg bg-terracotta/10 p-2 text-sm">
                    <strong>Cancelled — do not prepare:</strong> {p.cancelled.dishes.map((d) => `${d.quantity}× ${d.name}`).join(", ")}
                  </p>
                )}
              </Card>
            </div>
          </section>

          {/* INGREDIENT REPORT */}
          <section aria-labelledby="ing-h" className="print-break">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="ing-h" className="font-display text-xl uppercase text-terracotta">Ingredient Preparation Report</h2>
              <div className="no-print flex gap-2 text-sm">
                <a className="rounded-full border-2 border-forest px-3 py-1 font-bold text-forest" href={dl("ingredients", "csv")}>CSV</a>
                <a className="rounded-full border-2 border-forest px-3 py-1 font-bold text-forest" href={dl("ingredients", "pdf")}>PDF</a>
              </div>
            </div>
            <Card className="mt-2 bg-white">
              {ing.ingredients.length === 0 ? (
                <p className="text-ink/60">Nothing to calculate yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-forest text-left">
                        <th className="py-1 pr-2">Ingredient</th><th className="pr-2">Total needed</th><th className="pr-2">Raw (from yield)</th><th>Used in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ing.ingredients.map((i) => (
                        <tr key={i.ingredientId} className="border-b border-forest/10 align-top">
                          <td className="py-1.5 pr-2 font-bold">{i.name}</td>
                          <td className="pr-2 text-lg font-display text-forest">{formatAmount(i.quantity, i.unit)}</td>
                          <td className="pr-2">{i.rawQuantity != null ? `${formatAmount(i.rawQuantity, i.unit)}${i.rawLabel ? ` ${i.rawLabel}` : ""} (${i.yieldPercent}% yield)` : "—"}</td>
                          <td className="text-ink/70">{i.breakdown.map((b) => `${b.dish} ×${b.dishQuantity}`).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ing.missingRecipes.length > 0 && (
                <p className="mt-3 rounded-lg bg-mustard/30 p-2 text-sm">
                  <strong>No recipe saved (not included):</strong> {ing.missingRecipes.map((m) => `${m.quantity}× ${m.name}`).join(", ")}. Add recipes in Menu → Edit.
                </p>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
