import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MenuAdmin } from "@/components/staff/MenuAdmin";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const user = (await getStaffUser())!;
  if (!can(user.role, "menu.availability")) redirect("/staff/kitchen");
  return <MenuAdmin canEdit={can(user.role, "menu.edit")} canRecipes={can(user.role, "recipes.manage")} />;
}
