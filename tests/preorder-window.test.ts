import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { getPreorderStatus } from "@/lib/preorder-window";
import { DEFAULT_SETTINGS, scheduleSchema } from "@/lib/settings";

const schedule = { ...DEFAULT_SETTINGS.schedule, operatingDays: [1, 2, 3, 4, 5] }; // Mon–Fri
const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/New_York" }).toJSDate();

describe("preorder window (America/New_York)", () => {
  // 2026-10-12 is a Monday (EDT, UTC-4)
  it("is closed at 8:59:59 AM", () => {
    expect(getPreorderStatus(at("2026-10-12T08:59:59"), schedule, []).open).toBe(false);
    expect(getPreorderStatus(at("2026-10-12T08:59:59"), schedule, []).reason).toBe("before_open");
  });
  it("opens exactly at 9:00 AM", () => {
    expect(getPreorderStatus(at("2026-10-12T09:00:00"), schedule, []).open).toBe(true);
  });
  it("is open at 10:29:59 AM", () => {
    expect(getPreorderStatus(at("2026-10-12T10:29:59"), schedule, []).open).toBe(true);
  });
  it("closes exactly at 10:30 AM", () => {
    const s = getPreorderStatus(at("2026-10-12T10:30:00"), schedule, []);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("after_close");
  });
  it("uses Eastern time regardless of server timezone (UTC instant)", () => {
    // 13:15 UTC = 9:15 AM EDT
    expect(getPreorderStatus(new Date("2026-10-12T13:15:00Z"), schedule, []).open).toBe(true);
    // 13:15 UTC in winter = 8:15 AM EST -> closed
    expect(getPreorderStatus(new Date("2026-12-14T13:15:00Z"), schedule, []).open).toBe(false);
    // 14:15 UTC in winter = 9:15 AM EST -> open
    expect(getPreorderStatus(new Date("2026-12-14T14:15:00Z"), schedule, []).open).toBe(true);
  });
  it("handles the daylight saving change day (Mon 2027-03-15 after Mar 14 switch)", () => {
    expect(getPreorderStatus(at("2027-03-15T09:05:00"), schedule, []).open).toBe(true);
    expect(getPreorderStatus(new Date("2027-03-15T13:05:00Z"), schedule, []).open).toBe(true); // 9:05 EDT
  });
  it("rejects non-operating days", () => {
    const s = getPreorderStatus(at("2026-10-11T09:30:00"), schedule, []); // Sunday
    expect(s.open).toBe(false);
    expect(s.reason).toBe("not_operating_day");
  });
  it("rejects blocked dates", () => {
    const s = getPreorderStatus(at("2026-10-12T09:30:00"), schedule, ["2026-10-12"]);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("closed_date");
  });
  it("respects manual close", () => {
    const s = getPreorderStatus(at("2026-10-12T09:30:00"), { ...schedule, manualClosed: true }, []);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("manual_closed");
  });
  it("stays closed until operating days are configured", () => {
    expect(getPreorderStatus(at("2026-10-12T09:30:00"), DEFAULT_SETTINGS.schedule, []).reason).toBe("not_configured");
  });
  it("finds the next opening, skipping closed dates", () => {
    const s = getPreorderStatus(at("2026-10-12T11:00:00"), schedule, ["2026-10-13"]);
    expect(DateTime.fromJSDate(s.nextOpenAt!, { zone: "America/New_York" }).toISO()).toBe("2026-10-14T09:00:00.000-04:00");
  });
  it("settings cannot schedule pickup before 11:00 AM", () => {
    expect(scheduleSchema.safeParse({ ...schedule, pickupStart: "10:45" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...schedule, pickupStart: "11:00" }).success).toBe(true);
  });
});
