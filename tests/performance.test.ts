import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildPerformanceReport, rushPace, type PerfOrder } from "@/lib/reports/performance";

const S = { kitchenStart: "10:30", capacityUnitsPerSlot: 8, slotMinutes: 15 };
const at = (date: string, hhmm: string) => DateTime.fromISO(`${date}T${hhmm}`, { zone: "America/New_York" }).toJSDate();
const o = (date: string, pickup: string, ready: string | null, units = 1, picked: string | null = null): PerfOrder => ({
  serviceDate: date,
  pickupAt: at(date, pickup),
  readyAt: ready ? at(date, ready) : null,
  pickedUpAt: picked ? at(date, picked) : null,
  workUnits: units,
});

describe("estimate accuracy report", () => {
  it("measures on-time rate and lateness against the promised pickup time", () => {
    const r = buildPerformanceReport(
      [o("2026-10-12", "11:00", "10:55", 1, "11:02"), o("2026-10-12", "11:00", "11:06"), o("2026-10-12", "11:15", "11:10"), o("2026-10-12", "11:15", null)],
      S,
    );
    expect(r.tracked).toBe(3);
    expect(r.onTimePct).toBe(67);
    expect(r.late).toBe(1);
    expect(r.avgLateMin).toBe(6);
    expect(r.avgPickupWaitMin).toBe(7);
    expect(r.bySlot.map((s) => s.label)).toEqual(["11:00 AM", "11:15 AM"]);
  });

  it("measures real kitchen pace during a fully booked rush", () => {
    // 16 orders promised at 11:00 (= full capacity from 10:30), but the last one was ready at 11:10
    const day = Array.from({ length: 16 }, (_, i) => o("2026-10-12", "11:00", i === 15 ? "11:10" : "10:58"));
    // 16 units over 40 minutes = 2.67 intervals → 6 units per 15 min
    expect(rushPace(day, S, "2026-10-12")).toBeCloseTo(6, 5);
  });

  it("ignores quiet days (kitchen was not cooking flat out)", () => {
    const quiet = [o("2026-10-12", "11:00", "10:40"), o("2026-10-12", "12:30", "12:28")];
    expect(rushPace(quiet, S, "2026-10-12")).toBeNull();
  });

  it("ignores a rush where some orders were never tapped Ready", () => {
    const day = Array.from({ length: 16 }, (_, i) => o("2026-10-12", "11:00", i === 3 ? null : "10:59"));
    expect(rushPace(day, S, "2026-10-12")).toBeNull();
  });

  it("suggests a new capacity only after 3+ busy mornings that disagree by more than 10%", () => {
    const busy = (date: string, last: string) => Array.from({ length: 16 }, (_, i) => o(date, "11:00", i === 15 ? last : "10:58"));
    const two = buildPerformanceReport([...busy("2026-10-12", "11:10"), ...busy("2026-10-13", "11:10")], S);
    expect(two.pace.measuredDays).toBe(2);
    expect(two.pace.suggestion).toBeNull();
    const three = buildPerformanceReport([...busy("2026-10-12", "11:10"), ...busy("2026-10-13", "11:10"), ...busy("2026-10-14", "11:10")], S);
    expect(three.pace.median).toBe(6);
    expect(three.pace.suggestion).toBe(6);
    const accurate = buildPerformanceReport([...busy("2026-10-12", "11:00"), ...busy("2026-10-13", "11:00"), ...busy("2026-10-14", "11:00")], S);
    expect(accurate.pace.median).toBe(8);
    expect(accurate.pace.suggestion).toBeNull();
  });
});
