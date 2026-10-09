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
    <div role="status" className="inline-flex items-center gap-3 rounded-2xl border-2 border-forest/20 bg-cream-light px-4 py-2 text-left">
      <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${status.open ? "animate-pulse bg-green-600" : "bg-terracotta"}`} aria-hidden />
      <span>
        <span className="block font-display text-[15px] uppercase tracking-wide text-forest">{status.open ? "Preorders are open" : status.message}</span>
        <span className="block text-sm text-ink/70">{preorderSubtext(status, schedule)}</span>
      </span>
    </div>
  );
}
