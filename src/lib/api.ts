import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { OrderError } from "./orders";
import { siteUrl } from "./site-url";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Rejects cross-site state-changing requests to staff APIs. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AuthError(403, "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(403, "Cross-site request blocked.");
  }
}

export function handleError(e: unknown) {
  if (e instanceof AuthError) return json({ error: e.message }, e.status);
  if (e instanceof OrderError) return json({ error: e.message, code: e.code, ...e.extra }, e.status);
  if (e instanceof ZodError) return json({ error: e.issues[0]?.message ?? "Invalid input", issues: e.issues }, 400);
  console.error(e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export function route<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      return handleError(e);
    }
  };
}

export function appUrl(req: Request): string {
  if (process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL) return siteUrl();
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}
