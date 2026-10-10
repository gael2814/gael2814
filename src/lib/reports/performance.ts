import { DateTime } from "luxon";
import { TZ } from "../time";

/**
 * Estimate accuracy report.
 * Compares the pickup time we promised with when the kitchen actually tapped
 * "Ready for Pickup", and measures the kitchen's real cooking pace so the
 * capacity setting can be tuned with real data.
 */

export type PerfOrder = {
  serviceDate: string;
  pickupAt: Date;
  readyAt: Date | null;
  pickedUpAt: Date | null;
  workUnits: number;
};

export type PerfSettings = { kitchenStart: string; capacityUnitsPerSlot: number; slotMinutes: number };

export type DayPerf = {
  date: string;
  orders: number;
  tracked: number;
  onTimePct: number | null;
  avgVsPromiseMin: number | null;
  lastReady: string | null;
  /** Measured pace (quesabirria-order units per interval) during the busy rush, if the day had one. */
  rushPace: number | null;
};

export type PerformanceReport = {
  orders: number;
  tracked: number; // orders with a "ready" time recorded
  onTimePct: number | null;
  late: number;
  avgVsPromiseMin: number | null; // negative = ready early
  avgLateMin: number | null;
  avgPickupWaitMin: number | null; // minutes food waited between "ready" and "picked up"
  bySlot: { label: string; orders: number; onTimePct: number | null; avgVsPromiseMin: number | null }[];
  byDay: DayPerf[];
  pace: { measuredDays: number; median: number | null; current: number; suggestion: number | null };
};

const mins = (ms: number) => ms / 60_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : null);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Kitchen pace on one day, measured only over the "rush": the first pickup
 * times that were booked to at least 80% of capacity. During the rush the
 * kitchen has to cook flat out, so its speed is real. Later, quieter orders are
 * often cooked closer to pickup on purpose, which would make the kitchen look slow.
 */
export function rushPace(orders: PerfOrder[], s: PerfSettings, serviceDate: string): number | null {
  const start = DateTime.fromISO(`${serviceDate}T${s.kitchenStart}`, { zone: TZ }).toMillis();
  const slotMs = s.slotMinutes * 60_000;
  const times = [...new Set(orders.map((o) => o.pickupAt.getTime()))].sort((a, b) => a - b);
  let cum = 0;
  let rushEnd: number | null = null;
  for (const t of times) {
    cum += orders.filter((o) => o.pickupAt.getTime() === t).reduce((a, o) => a + o.workUnits, 0);
    const cap = ((t - start) / slotMs) * s.capacityUnitsPerSlot;
    if (cap > 0 && cum >= 0.8 * cap) rushEnd = t;
    else break;
  }
  if (rushEnd == null) return null;
  const rush = orders.filter((o) => o.pickupAt.getTime() <= rushEnd!);
  const units = rush.reduce((a, o) => a + o.workUnits, 0);
  if (units < s.capacityUnitsPerSlot || rush.some((o) => !o.readyAt)) return null; // too little work, or missing taps
  const lastReady = Math.max(...rush.map((o) => o.readyAt!.getTime()));
  const intervals = (lastReady - start) / slotMs;
  if (intervals <= 0) return null;
  return units / intervals;
}

export function buildPerformanceReport(orders: PerfOrder[], s: PerfSettings): PerformanceReport {
  const tracked = orders.filter((o) => o.readyAt);
  const diff = (o: PerfOrder) => mins(o.readyAt!.getTime() - o.pickupAt.getTime());
  const late = tracked.filter((o) => diff(o) > 0);

  const slotMap = new Map<string, { sort: number; label: string; os: PerfOrder[] }>();
  for (const o of tracked) {
    const t = DateTime.fromJSDate(o.pickupAt, { zone: TZ });
    const key = t.toFormat("HH:mm");
    const e = slotMap.get(key) ?? { sort: t.hour * 60 + t.minute, label: t.toFormat("h:mm a"), os: [] };
    e.os.push(o);
    slotMap.set(key, e);
  }

  const dates = [...new Set(orders.map((o) => o.serviceDate))].sort();
  const byDay: DayPerf[] = dates.map((date) => {
    const os = orders.filter((o) => o.serviceDate === date);
    const tr = os.filter((o) => o.readyAt);
    const last = tr.length ? Math.max(...tr.map((o) => o.readyAt!.getTime())) : null;
    const pace = rushPace(os, s, date);
    return {
      date,
      orders: os.length,
      tracked: tr.length,
      onTimePct: pct(tr.filter((o) => diff(o) <= 0).length, tr.length),
      avgVsPromiseMin: r1(avg(tr.map(diff))),
      lastReady: last ? DateTime.fromMillis(last, { zone: TZ }).toFormat("h:mm a") : null,
      rushPace: pace == null ? null : r1(pace),
    };
  });

  const paces = byDay.map((d) => d.rushPace).filter((p): p is number => p != null);
  const med = median(paces);
  let suggestion: number | null = null;
  // Suggest only with at least 3 busy mornings and a meaningful (>10%) difference. Rounded to the nearest half order.
  if (med != null && paces.length >= 3 && Math.abs(med - s.capacityUnitsPerSlot) / s.capacityUnitsPerSlot > 0.1)
    suggestion = Math.max(0.5, Math.round(med * 2) / 2);

  const waits = orders.filter((o) => o.readyAt && o.pickedUpAt).map((o) => mins(o.pickedUpAt!.getTime() - o.readyAt!.getTime()));

  return {
    orders: orders.length,
    tracked: tracked.length,
    onTimePct: pct(tracked.length - late.length, tracked.length),
    late: late.length,
    avgVsPromiseMin: r1(avg(tracked.map(diff))),
    avgLateMin: r1(avg(late.map(diff))),
    avgPickupWaitMin: r1(avg(waits)),
    bySlot: [...slotMap.values()]
      .sort((a, b) => a.sort - b.sort)
      .map((e) => ({
        label: e.label,
        orders: e.os.length,
        onTimePct: pct(e.os.filter((o) => diff(o) <= 0).length, e.os.length),
        avgVsPromiseMin: r1(avg(e.os.map(diff))),
      })),
    byDay,
    pace: { measuredDays: paces.length, median: r1(med), current: s.capacityUnitsPerSlot, suggestion },
  };
}
