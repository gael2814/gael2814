import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { TimingView } from "@/components/staff/TimingView";

export const metadata = { title: "Timing" };

export default async function TimingPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "schedule.manage")) redirect("/staff/kitchen");
  return <TimingView />;
}
