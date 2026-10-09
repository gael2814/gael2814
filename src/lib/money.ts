export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}${rem === 0 ? "" : "." + String(rem).padStart(2, "0")}`;
}

/** Always shows two decimals, for receipts and totals. */
export function formatCentsExact(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Tax in basis points (800 = 8.00%), rounded half-up to the cent. */
export function computeTax(subtotalCents: number, rateBps: number): number {
  return Math.round((subtotalCents * rateBps) / 10000);
}

export function parseDollarsToCents(input: string | number): number | null {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
