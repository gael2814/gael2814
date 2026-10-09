import { DateTime } from "luxon";

export const TZ = "America/New_York";

/**
 * Current time. In non-production environments DEV_NOW_OVERRIDE (ISO string,
 * e.g. "2026-10-12T09:30:00-04:00") lets you preview the ordering window at any
 * time of day. It is ignored in production.
 */
export function getNow(): Date {
  const o = process.env.DEV_NOW_OVERRIDE;
  if (o && process.env.NODE_ENV !== "production") {
    const d = DateTime.fromISO(o, { zone: TZ });
    if (d.isValid) return d.toJSDate();
  }
  return new Date();
}

export function inTz(d: Date | number): DateTime {
  return DateTime.fromMillis(typeof d === "number" ? d : d.getTime(), { zone: TZ });
}

/** "YYYY-MM-DD" of the given instant in America/New_York. */
export function serviceDateOf(d: Date | number): string {
  return inTz(d).toISODate()!;
}

/** Instant for a wall-clock "HH:mm" on a service date in America/New_York (DST aware). */
export function atLocalTime(serviceDate: string, hhmm: string): DateTime {
  return DateTime.fromISO(`${serviceDate}T${hhmm}`, { zone: TZ });
}

export function formatTime(d: Date | number): string {
  return inTz(d).toFormat("h:mm a");
}

export function formatDate(d: Date | number | string): string {
  const dt = typeof d === "string" ? DateTime.fromISO(d, { zone: TZ }) : inTz(d);
  return dt.toFormat("cccc, LLLL d");
}

export function formatHHmm(hhmm: string): string {
  return DateTime.fromFormat(hhmm, "HH:mm").toFormat("h:mm a");
}

export function isValidHHmm(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Luxon weekday: 1 = Monday ... 7 = Sunday */
export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];
