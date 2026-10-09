import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SalesView } from "@/components/staff/SalesView";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "sales.view")) redirect("/staff/kitchen");
  return <SalesView />;
}
