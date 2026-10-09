import { atLocalTime } from "./time";
import type { KitchenSettings, ScheduleSettings } from "./settings";

/**
 * Pickup scheduling model
 * -----------------------
 * Every menu item has a workload in "units". 1 unit = 1 quesabirria order
 * (3 tacos). The kitchen completes `capacityUnitsPerSlot` units per pickup
 * interval (benchmark: 8 quesabirria orders per 15 minutes), starting at
 * `kitchenStart` (which may be before opening) or "now", whichever is later.
 *
 * Orders are cooked in pickup-time order. A schedule is realistic when, for
 * every pickup slot S, the work of all orders due at or before S fits in the
 * kitchen time available before S:
 *
 *     sum(units of orders with pickup <= S)  <=  capacity * (S - start) / interval
 *
 * A new order can take slot T only if adding it keeps that true for T and
 * every later slot (it consumes kitchen time that later orders also need).
 * The earliest such T is the order's estimated pickup time.
 */

export type ExistingLoad = { pickupAt: number; units: number };

export type SlotInfo = {
  at: number; // epoch ms
  bookedUnits: number; // units due exactly in this slot
  bookedOrders: number;
  cumulativeUnits: number; // units due at or before this slot
  cumulativeCapacity: number; // kitchen units completable by this slot
  available: boolean; // can take at least a minimal order
};

export type ScheduleInput = {
  serviceDate: string;
  schedule: Pick<ScheduleSettings, "pickupStart" | "pickupEnd" | "slotMinutes">;
  kitchen: Pick<KitchenSettings, "capacityUnitsPerSlot" | "kitchenStart" | "maxOrdersPerSlot">;
  existing: ExistingLoad[];
  now: number;
  /** Customers can't be given a pickup sooner than this many minutes from now. */
  minLeadMinutes?: number;
};

const EPS = 1e-9;

export function slotTimes(serviceDate: string, schedule: ScheduleInput["schedule"]): number[] {
  const out: number[] = [];
  let t = atLocalTime(serviceDate, schedule.pickupStart);
  const end = atLocalTime(serviceDate, schedule.pickupEnd);
  while (t <= end) {
    out.push(t.toMillis());
    t = t.plus({ minutes: schedule.slotMinutes });
  }
  return out;
}

export function buildSlots(input: ScheduleInput): SlotInfo[] {
  const times = slotTimes(input.serviceDate, input.schedule);
  const kitchenStart = atLocalTime(input.serviceDate, input.kitchen.kitchenStart).toMillis();
  const start = Math.max(kitchenStart, input.now);
  const slotMs = input.schedule.slotMinutes * 60_000;
  let cumulative = 0;
  // Orders due before the first slot (shouldn't exist) count toward the first.
  const sorted = [...input.existing].sort((a, b) => a.pickupAt - b.pickupAt);
  let idx = 0;
  return times.map((at) => {
    let booked = 0;
    let count = 0;
    while (idx < sorted.length && sorted[idx].pickupAt <= at) {
      booked += sorted[idx].units;
      count++;
      idx++;
    }
    cumulative += booked;
    const cumulativeCapacity = Math.max(0, ((at - start) / slotMs) * input.kitchen.capacityUnitsPerSlot);
    return {
      at,
      bookedUnits: booked,
      bookedOrders: count,
      cumulativeUnits: cumulative,
      cumulativeCapacity,
      available: false,
    };
  });
}

/** All slots that could accept a new order of `units` workload. */
export function feasibleSlots(input: ScheduleInput, units: number): number[] {
  const slots = buildSlots(input);
  const minAt = input.now + (input.minLeadMinutes ?? 15) * 60_000;
  const result: number[] = [];
  // suffixOk[i] = every slot j >= i can absorb `units` more.
  const suffixOk: boolean[] = new Array(slots.length + 1).fill(true);
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    suffixOk[i] = suffixOk[i + 1] && s.cumulativeUnits + units <= s.cumulativeCapacity + EPS;
  }
  slots.forEach((s, i) => {
    if (s.at < minAt) return;
    if (!suffixOk[i]) return;
    if (input.kitchen.maxOrdersPerSlot != null && s.bookedOrders >= input.kitchen.maxOrdersPerSlot) return;
    result.push(s.at);
  });
  return result;
}

export function earliestPickup(input: ScheduleInput, units: number): number | null {
  return feasibleSlots(input, units)[0] ?? null;
}

export function orderUnits(items: { prepUnits: number; quantity: number }[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.prepUnits * i.quantity, 0) * 1000) / 1000;
}
