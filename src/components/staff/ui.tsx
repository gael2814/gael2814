"use client";
import type { ReactNode } from "react";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl uppercase tracking-wide text-forest sm:text-3xl">{children}</h1>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-forest/30 bg-cream-light p-4 ${className}`}>{children}</div>;
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const v = {
    primary: "bg-forest text-cream hover:bg-forest-light",
    secondary: "bg-mustard text-forest hover:bg-mustard-light",
    danger: "bg-terracotta text-cream hover:bg-terracotta-dark",
    ghost: "border-2 border-forest/40 text-forest hover:bg-forest/10",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: ReactNode }) {
  const c = { info: "bg-mustard/30 text-ink", error: "bg-terracotta text-cream", ok: "bg-forest-light text-cream" }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-semibold ${c}`}>{children}</div>;
}

export const inputCls = "w-full rounded-lg border-2 border-forest/30 bg-white px-2.5 py-1.5 text-sm";
