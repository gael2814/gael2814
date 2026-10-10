import { atLocalTime, inTz } from "./time";
import type { ScheduleSettings } from "./settings";

export type PreorderStatus = {
  open: boolean;
  /** Why ordering is open/closed, for display. */
  reason:
    | "open"
    | "before_open"
    | "after_close"
    | "not_operating_day"
    | "closed_date"
    | "manual_closed"
    | "not_configured";
  message: string;
  serviceDate: string;
  opensAt: Date;
  closesAt: Date;
  /** Next moment preorders will open (if known within the next 14 days). */
  nextOpenAt: Date | null;
};

function isOperatingDate(date: string, schedule: ScheduleSettings, closedDates: Set<string>): boolean {
  const weekday = atLocalTime(date, "12:00").weekday;
  return schedule.operatingDays.includes(weekday) && !closedDates.has(date);
}

/**
 * Pure function deciding whether lunch preorders are open at `now`.
 * All server-side checks go through this.
 */
export function getPreorderStatus(now: Date, schedule: ScheduleSettings, closedDateList: string[]): PreorderStatus {
  const closedDates = new Set(closedDateList);
  const local = inTz(now);
  const serviceDate = local.toISODate()!;
  const opensAt = atLocalTime(serviceDate, schedule.preorderOpen);
  const closesAt = atLocalTime(serviceDate, schedule.preorderClose);

  let nextOpenAt: Date | null = null;
  for (let i = 0; i < 15; i++) {
    const d = local.plus({ days: i }).toISODate()!;
    const open = atLocalTime(d, schedule.preorderOpen);
    if (i === 0 && local >= open) continue;
    if (isOperatingDate(d, schedule, closedDates)) {
      nextOpenAt = open.toJSDate();
      break;
    }
  }

  const base = { serviceDate, opensAt: opensAt.toJSDate(), closesAt: closesAt.toJSDate(), nextOpenAt };

  if (schedule.operatingDays.length === 0)
    return { ...base, open: false, reason: "not_configured", message: "Online preorders are coming soon." };
  if (schedule.manualClosed)
    return { ...base, open: false, reason: "manual_closed", message: schedule.closedMessage };
  if (closedDates.has(serviceDate))
    return { ...base, open: false, reason: "closed_date", message: "We're closed for online preorders today." };
  if (!schedule.operatingDays.includes(local.weekday))
    return { ...base, open: false, reason: "not_operating_day", message: "We don't take online preorders today." };
  if (local < opensAt)
    return { ...base, open: false, reason: "before_open", message: "Preorders open soon." };
  if (local >= closesAt)
    return { ...base, open: false, reason: "after_close", message: "Today's preorders are closed." };
  return { ...base, open: true, reason: "open", message: "Preorders are open!" };
}
