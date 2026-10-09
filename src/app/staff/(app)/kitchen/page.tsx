import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getNow, serviceDateOf } from "@/lib/time";
import { KitchenBoard } from "@/components/staff/KitchenBoard";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "kitchen.view")) redirect("/staff");
  return <KitchenBoard today={serviceDateOf(getNow())} canManage={can(user.role, "orders.manage")} canRefund={can(user.role, "refunds.process")} />;
}
