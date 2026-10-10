"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

const LINKS: { href: string; label: string; perm: Permission }[] = [
  { href: "/staff/kitchen", label: "Kitchen", perm: "kitchen.view" },
  { href: "/staff/production", label: "Production", perm: "production.view" },
  { href: "/staff/orders", label: "Orders", perm: "orders.manage" },
  { href: "/staff/menu", label: "Menu", perm: "menu.availability" },
  { href: "/staff/schedule", label: "Schedule", perm: "schedule.manage" },
  { href: "/staff/timing", label: "Timing", perm: "schedule.manage" },
  { href: "/staff/sales", label: "Sales", perm: "sales.view" },
  { href: "/staff/settings", label: "Business", perm: "business.manage" },
  { href: "/staff/users", label: "Staff", perm: "users.manage" },
];

export function StaffNav({ user }: { user: StaffUser }) {
  const path = usePathname();
  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    window.location.href = "/staff/login";
  }
  return (
    <header className="no-print sticky top-0 z-30 bg-forest text-cream shadow">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6">
        <Link href="/" title="View website" className="shrink-0 rounded-full bg-cream p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="Ay Ay Tacos" className="h-9 w-9 object-contain" />
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Staff">
          {LINKS.filter((l) => can(user.role, l.perm)).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${path.startsWith(l.href) ? "bg-mustard text-forest" : "hover:bg-forest-light"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden text-right text-xs sm:block">
          <div className="font-semibold">{user.name}</div>
          <div className="opacity-70">{user.role.toLowerCase()}</div>
        </div>
        <button onClick={logout} className="shrink-0 rounded-full border border-cream/50 px-3 py-1 text-xs">Sign out</button>
      </div>
      <div className="serape !h-1.5" />
    </header>
  );
}
