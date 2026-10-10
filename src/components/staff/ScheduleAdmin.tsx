"use client";
import { useCallback, useEffect, useState } from "react";
import type { AllSettings } from "@/lib/settings";
import { api } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type Data = { settings: AllSettings; closedDates: { id: string; date: string; reason: string | null }[] };

export function ScheduleAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [s, setS] = useState<AllSettings["schedule"] | null>(null);
  const [k, setK] = useState<AllSettings["kitchen"] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [closed, setClosed] = useState({ date: "", reason: "" });

  const load = useCallback(async () => {
    const d = await api<Data>("/api/staff/settings");
    setData(d);
    setS(d.settings.schedule);
    setK(d.settings.kitchen);
  }, []);
  useEffect(() => {
    load().catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [load]);

  async function save(key: "schedule" | "kitchen", value: object, ok: string) {
    try {
      await api("/api/staff/settings", { method: "PATCH", body: { key, value } });
      setMsg({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  if (!data || !s || !k) return <p className="animate-pulse">Loading…</p>;
  const lbl = "block text-xs font-bold uppercase tracking-wide text-forest";

  return (
    <div className="space-y-4">
      <PageTitle>Preorder Schedule & Kitchen</PageTitle>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <Card className={`border-4 ${s.manualClosed ? "border-terracotta" : "border-forest"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-forest">Online preorders: {s.manualClosed ? "CLOSED by staff" : "Automatic"}</h2>
            <p className="text-sm text-ink/70">Use this to stop online orders right now (e.g., kitchen is full or an emergency).</p>
          </div>
          <Btn
            variant={s.manualClosed ? "primary" : "danger"}
            onClick={() => save("schedule", { manualClosed: !s.manualClosed }, s.manualClosed ? "Preorders back on the automatic schedule." : "Online preorders closed.")}
          >
            {s.manualClosed ? "Reopen preorders" : "Close preorders now"}
          </Btn>
        </div>
        <label className={`${lbl} mt-3`}>Message shown to customers when closed
          <input className={inputCls} value={s.closedMessage} onChange={(e) => setS({ ...s, closedMessage: e.target.value })} />
        </label>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Hours & operating days</h2>
        <p className="text-sm text-ink/70">All times are Eastern Time (America/New_York). Pickup can never start before 11:00 AM.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <label className={lbl}>Preorders open<input type="time" className={inputCls} value={s.preorderOpen} onChange={(e) => setS({ ...s, preorderOpen: e.target.value })} /></label>
          <label className={lbl}>Preorders close<input type="time" className={inputCls} value={s.preorderClose} onChange={(e) => setS({ ...s, preorderClose: e.target.value })} /></label>
          <label className={lbl}>First pickup<input type="time" min="11:00" className={inputCls} value={s.pickupStart} onChange={(e) => setS({ ...s, pickupStart: e.target.value })} /></label>
          <label className={lbl}>Last pickup<input type="time" className={inputCls} value={s.pickupEnd} onChange={(e) => setS({ ...s, pickupEnd: e.target.value })} /></label>
          <label className={lbl}>Pickup interval (min)<input type="number" min={5} max={60} className={inputCls} value={s.slotMinutes} onChange={(e) => setS({ ...s, slotMinutes: Number(e.target.value) })} /></label>
        </div>
        <fieldset className="mt-3">
          <legend className={lbl}>Days we take lunch preorders</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const v = i + 1;
              const on = s.operatingDays.includes(v);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setS({ ...s, operatingDays: on ? s.operatingDays.filter((x) => x !== v) : [...s.operatingDays, v].sort() })}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${on ? "bg-forest text-cream" : "bg-cream-dark text-forest"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {s.operatingDays.length === 0 && <p className="mt-2 text-sm font-semibold text-terracotta">No days selected — online preorders stay closed until you choose operating days.</p>}
        </fieldset>
        <Btn className="mt-3" onClick={() => save("schedule", s, "Schedule saved.")}>Save schedule</Btn>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Holidays & closed dates</h2>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/api/staff/closed-dates", { body: closed });
              setClosed({ date: "", reason: "" });
              setMsg({ kind: "ok", text: "Date blocked." });
              await load();
            } catch (err) {
              setMsg({ kind: "error", text: err instanceof Error ? err.message : "Failed" });
            }
          }}
        >
          <input required type="date" className={`${inputCls} w-44`} value={closed.date} onChange={(e) => setClosed({ ...closed, date: e.target.value })} />
          <input placeholder="Reason (optional)" className={`${inputCls} max-w-xs`} value={closed.reason} onChange={(e) => setClosed({ ...closed, reason: e.target.value })} />
          <Btn type="submit">Block date</Btn>
        </form>
        <ul className="mt-3 divide-y divide-forest/10">
          {data.closedDates.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
              <span><strong>{c.date}</strong> {c.reason && `— ${c.reason}`}</span>
              <button
                className="text-terracotta underline"
                onClick={async () => {
                  await api(`/api/staff/closed-dates?date=${c.date}`, { method: "DELETE" });
                  await load();
                }}
              >
                Unblock
              </button>
            </li>
          ))}
          {data.closedDates.length === 0 && <li className="py-1.5 text-sm text-ink/60">No blocked dates.</li>}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Kitchen capacity</h2>
        <p className="text-sm text-ink/70">
          Pickup times are calculated from how much the kitchen can make per pickup interval. Workload is measured in
          <strong> quesabirria orders</strong> (1 order = 3 tacos). Your benchmark: <strong>8 orders every 15 minutes</strong>.
          Each menu item&apos;s workload is set in Menu → Edit.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className={lbl}>Orders per interval<input type="number" step="0.5" min={0.5} className={inputCls} value={k.capacityUnitsPerSlot} onChange={(e) => setK({ ...k, capacityUnitsPerSlot: Number(e.target.value) })} /></label>
          <label className={lbl}>Kitchen starts cooking<input type="time" className={inputCls} value={k.kitchenStart} onChange={(e) => setK({ ...k, kitchenStart: e.target.value })} /></label>
          <label className={lbl}>Max orders per pickup time<input type="number" min={1} placeholder="No limit" className={inputCls} value={k.maxOrdersPerSlot ?? ""} onChange={(e) => setK({ ...k, maxOrdersPerSlot: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className={lbl}>&quot;Due soon&quot; warning (min)<input type="number" min={1} max={60} className={inputCls} value={k.dueSoonMinutes} onChange={(e) => setK({ ...k, dueSoonMinutes: Number(e.target.value) })} /></label>
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Tip: if you have extra staff on a busy day, raise &quot;orders per interval&quot;. If the kitchen starts cooking earlier, move &quot;kitchen starts cooking&quot; earlier — customers still never pick up before opening.
        </p>
        <Btn className="mt-3" onClick={() => save("kitchen", k, "Kitchen capacity saved.")}>Save capacity</Btn>
      </Card>
    </div>
  );
}
