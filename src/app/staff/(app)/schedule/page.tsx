import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ScheduleAdmin } from "@/components/staff/ScheduleAdmin";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "schedule.manage")) redirect("/staff/kitchen");
  return <ScheduleAdmin />;
}
