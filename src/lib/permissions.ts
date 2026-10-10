import type { Role } from "@prisma/client";

/**
 * Role-based permissions.
 *  Owner:   everything.
 *  Manager: orders, menu availability, scheduling and production.
 *  Kitchen: kitchen orders and production reports only.
 */
export const PERMISSIONS = {
  "kitchen.view": ["OWNER", "MANAGER", "KITCHEN"],
  "kitchen.status": ["OWNER", "MANAGER", "KITCHEN"],
  "production.view": ["OWNER", "MANAGER", "KITCHEN"],
  "orders.manage": ["OWNER", "MANAGER"],
  "menu.availability": ["OWNER", "MANAGER"],
  "menu.prep": ["OWNER", "MANAGER"],
  "menu.edit": ["OWNER"],
  "recipes.manage": ["OWNER", "MANAGER"],
  "schedule.manage": ["OWNER", "MANAGER"],
  "refunds.process": ["OWNER"],
  "sales.view": ["OWNER"],
  "users.manage": ["OWNER"],
  "business.manage": ["OWNER"],
} as const satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  return !!role && (PERMISSIONS[perm] as readonly Role[]).includes(role);
}
