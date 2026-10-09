import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import { StaffNav } from "@/components/staff/StaffNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Staff", template: "%s | Ay Ay Tacos Staff" }, robots: { index: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/staff/login");
  return (
    <div className="min-h-screen bg-cream">
      <StaffNav user={user} />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6">{children}</div>
    </div>
  );
}
