import type { PreorderStatus } from "@/lib/preorder-window";
import { formatHHmm, inTz } from "@/lib/time";
import type { ScheduleSettings } from "@/lib/settings";

export function preorderSubtext(status: PreorderStatus, schedule: ScheduleSettings): string {
  if (status.open) return `Order until ${formatHHmm(schedule.preorderClose)} · Pickup from ${formatHHmm(schedule.pickupStart)}`;
  if (status.nextOpenAt) {
    const n = inTz(status.nextOpenAt);
    const today = inTz(new Date(status.opensAt)).hasSame(n, "day");
    return `Next preorders open ${today ? "today" : n.toFormat("cccc")} at ${n.toFormat("h:mm a")}`;
  }
  return `Preorders are taken ${formatHHmm(schedule.preorderOpen)}–${formatHHmm(schedule.preorderClose)} on operating days.`;
}

export function PreorderBadge({ status, schedule }: { status: PreorderStatus; schedule: ScheduleSettings }) {
  return (
    <div
      role="status"
      className={`inline-flex flex-col items-center rounded-2xl border-2 px-4 py-2 text-center ${
        status.open ? "border-mustard bg-forest-light text-cream" : "border-cream/60 bg-black/20 text-cream"
      }`}
    >
      <span className="flex items-center gap-2 font-display text-base uppercase tracking-wide">
        <span className={`inline-block h-3 w-3 rounded-full ${status.open ? "animate-pulse bg-green-400" : "bg-terracotta-light"}`} aria-hidden />
        {status.open ? "Preorders are open" : status.message}
      </span>
      <span className="text-xs opacity-90">{preorderSubtext(status, schedule)}</span>
    </div>
  );
}
