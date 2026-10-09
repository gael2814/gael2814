import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { BusinessAdmin } from "@/components/staff/BusinessAdmin";

export const metadata = { title: "Business Settings" };

export default async function SettingsPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "business.manage")) redirect("/staff/kitchen");
  return <BusinessAdmin />;
}
