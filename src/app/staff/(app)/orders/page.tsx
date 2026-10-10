import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getNow, serviceDateOf } from "@/lib/time";
import { OrdersView } from "@/components/staff/OrdersView";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "orders.manage")) redirect("/staff/kitchen");
  return <OrdersView today={serviceDateOf(getNow())} canRefund={can(user.role, "refunds.process")} />;
}
