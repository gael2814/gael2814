"use client";
import { useEffect } from "react";

/** Frees the reserved kitchen capacity as soon as the customer backs out of payment. */
export function ReleaseHold({ token }: { token: string }) {
  useEffect(() => {
    fetch("/api/checkout/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
  }, [token]);
  return null;
}
