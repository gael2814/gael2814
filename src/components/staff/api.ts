"use client";

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    window.location.href = `/staff/login?next=${encodeURIComponent(location.pathname)}`;
  }
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d as T;
}

export const fmtTime = (iso: string | number) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export const money = (c: number) => `$${(c / 100).toFixed(2)}`;
