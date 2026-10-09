import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildSlots, earliestPickup, feasibleSlots, slotTimes, type ScheduleInput } from "@/lib/scheduling";

const date = "2026-10-12";
const t = (hhmm: string) => DateTime.fromISO(`${date}T${hhmm}`, { zone: "America/New_York" }).toMillis();
const fmt = (ms: number | null) => (ms == null ? null : DateTime.fromMillis(ms, { zone: "America/New_York" }).toFormat("HH:mm"));

function input(existing: { pickupAt: number; units: number }[], over: Partial<ScheduleInput["kitchen"]> = {}, now = t("09:30")): ScheduleInput {
  return {
    serviceDate: date,
    schedule: { pickupStart: "11:00", pickupEnd: "13:00", slotMinutes: 15 },
    // Benchmark: 8 quesabirria orders per 15 minutes, kitchen starts 10:45.
    kitchen: { capacityUnitsPerSlot: 8, kitchenStart: "10:45", maxOrdersPerSlot: null, ...over },
    existing,
    now,
  };
}

describe("pickup scheduling", () => {
  it("generates 15-minute slots from 11:00", () => {
    expect(slotTimes(date, { pickupStart: "11:00", pickupEnd: "12:30", slotMinutes: 15 }).map(fmt)).toEqual([
      "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30",
    ]);
  });

  it("never offers pickup before 11:00 even if the kitchen starts early", () => {
    const slots = feasibleSlots(input([], { kitchenStart: "09:00" }), 1);
    expect(fmt(slots[0])).toBe("11:00");
  });

  it("8 quesabirria orders fit by 11:00; the 9th moves to 11:15", () => {
    const existing = Array.from({ length: 8 }, () => ({ pickupAt: t("11:00"), units: 1 }));
    expect(fmt(earliestPickup(input(existing.slice(0, 7)), 1))).toBe("11:00");
    expect(fmt(earliestPickup(input(existing), 1))).toBe("11:15");
  });

  it("a single order is not assumed to take 15 minutes", () => {
    // 3 small orders easily share 11:00
    const existing = [{ pickupAt: t("11:00"), units: 2 }, { pickupAt: t("11:00"), units: 3 }];
    expect(fmt(earliestPickup(input(existing), 3))).toBe("11:00");
  });

  it("large orders get a realistic later time", () => {
    // 20 quesabirria orders need 2.5 intervals of kitchen time starting 10:45 -> 11:30
    expect(fmt(earliestPickup(input([]), 20))).toBe("11:30");
  });

  it("does not starve later orders (cumulative capacity check)", () => {
    // 11:15 already holds 16 units = everything the kitchen can make by 11:15.
    const existing = [{ pickupAt: t("11:15"), units: 16 }];
    // Putting even 1 unit at 11:00 would make the 11:15 orders late.
    expect(fmt(earliestPickup(input(existing), 1))).toBe("11:30");
  });

  it("respects an optional per-slot order cap", () => {
    const existing = [{ pickupAt: t("11:00"), units: 0.1 }, { pickupAt: t("11:00"), units: 0.1 }];
    expect(fmt(earliestPickup(input(existing, { maxOrdersPerSlot: 2 }), 0.1))).toBe("11:15");
  });

  it("returns null when the day is fully booked", () => {
    const capBy1300 = 8 * 9; // 10:45 → 13:00 = 9 intervals
    expect(earliestPickup(input([{ pickupAt: t("13:00"), units: capBy1300 }]), 1)).toBeNull();
  });

  it("only uses kitchen time from now onward when the kitchen already started", () => {
    // Kitchen starts 10:00 but it's 10:29 now; 11:00 has ~2 intervals of capacity left (≈16.5 units)
    const s = input([], { kitchenStart: "10:00" }, t("10:29"));
    expect(fmt(earliestPickup(s, 16))).toBe("11:00");
    expect(fmt(earliestPickup(s, 17))).toBe("11:15");
  });

  it("reports slot capacity", () => {
    const slots = buildSlots(input([{ pickupAt: t("11:00"), units: 4 }]));
    expect(slots[0].cumulativeCapacity).toBe(8);
    expect(slots[0].bookedUnits).toBe(4);
  });

  it("handles daylight saving dates", () => {
    const d = "2027-03-15";
    expect(
      slotTimes(d, { pickupStart: "11:00", pickupEnd: "11:30", slotMinutes: 15 }).map((ms) =>
        DateTime.fromMillis(ms, { zone: "America/New_York" }).toISO(),
      ),
    ).toEqual(["2027-03-15T11:00:00.000-04:00", "2027-03-15T11:15:00.000-04:00", "2027-03-15T11:30:00.000-04:00"]);
  });
});
