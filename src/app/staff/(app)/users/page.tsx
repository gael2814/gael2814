import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { UsersAdmin } from "@/components/staff/UsersAdmin";

export const metadata = { title: "Staff Accounts" };

export default async function UsersPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "users.manage")) redirect("/staff/kitchen");
  return <UsersAdmin meId={user.id} />;
}
