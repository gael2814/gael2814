import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./auth-token";
import { can, type Permission } from "./permissions";

export type StaffUser = { id: string; email: string; name: string; role: Role };

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(user: StaffUser) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current staff user, re-checked against the database (deactivated users lose access immediately). */
export async function getStaffUser(): Promise<StaffUser | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function requirePermission(perm: Permission): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) throw new AuthError(401, "Please sign in.");
  if (!can(user.role, perm)) throw new AuthError(403, "You don't have permission to do that.");
  return user;
}

// Simple in-memory login throttle (per server instance).
const attempts = new Map<string, { count: number; until: number }>();
export function loginThrottle(key: string): { blocked: boolean; fail: () => void; reset: () => void } {
  const now = Date.now();
  const a = attempts.get(key);
  const blocked = !!a && a.count >= 5 && a.until > now;
  return {
    blocked,
    fail: () => {
      const cur = attempts.get(key);
      const count = cur && cur.until > now ? cur.count + 1 : 1;
      attempts.set(key, { count, until: now + 15 * 60_000 });
    },
    reset: () => attempts.delete(key),
  };
}
