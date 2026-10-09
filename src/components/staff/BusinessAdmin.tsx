"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import type { AllSettings } from "@/lib/settings";
import { api } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

export function BusinessAdmin() {
  const [b, setB] = useState<AllSettings["business"] | null>(null);
  const [tax, setTax] = useState<{ rate: string; label: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ settings: AllSettings }>("/api/staff/settings");
    setB(d.settings.business);
    setTax({ rate: (d.settings.tax.rateBps / 100).toFixed(2), label: d.settings.tax.label });
  }, []);
  useEffect(() => {
    load().catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [load]);

  async function save(key: "business" | "tax", value: object, ok: string) {
    try {
      await api("/api/staff/settings", { method: "PATCH", body: { key, value } });
      setMsg({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function upload(file: File, field: "logoImageId" | "heroImageId") {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/staff/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) return setMsg({ kind: "error", text: d.error });
    await save("business", { [field]: d.id }, "Image uploaded.");
  }

  if (!b || !tax) return <p className="animate-pulse">Loading…</p>;
  const lbl = "block text-xs font-bold uppercase tracking-wide text-forest";
  const field = (k: keyof AllSettings["business"], label: string, type = "text") => (
    <label className={lbl}>
      {label}
      <input type={type} className={inputCls} value={(b[k] as string) ?? ""} onChange={(e) => setB({ ...b, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-4">
      <PageTitle>Business Settings</PageTitle>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <Card>
        <h2 className="font-display text-xl text-forest">Logo</h2>
        <p className="text-sm text-ink/70">Upload your original Ay Ay Tacos moose logo (PNG with transparent background works best).</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-forest">
            {b.logoImageId ? <img src={`/api/images/${b.logoImageId}`} alt="Current logo" className="h-24 w-24 object-contain" /> : <span className="text-xs text-cream">No logo yet</span>}
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logoImageId")} />
          {b.logoImageId && <Btn variant="ghost" onClick={() => save("business", { logoImageId: null }, "Logo removed.")}>Remove</Btn>}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Homepage signature photo</h2>
        <p className="text-sm text-ink/70">The big photo in the &quot;Our most popular dish&quot; section. Leave empty to use the built-in quesabirria photo.</p>
        <div className="mt-2 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.heroImageId ? `/api/images/${b.heroImageId}` : "/photos/quesabirrias-griddle.jpg"} alt="Current signature photo" className="h-28 w-28 rounded-full object-cover" />
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "heroImageId")} />
          {b.heroImageId && <Btn variant="ghost" onClick={() => save("business", { heroImageId: null }, "Signature photo reset.")}>Use default</Btn>}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Contact & location</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {field("name", "Restaurant name")}
          {field("tagline", "Tagline")}
          {field("addressLine1", "Street address")}
          <div className="grid grid-cols-3 gap-2">
            {field("city", "City")}
            {field("state", "State")}
            {field("zip", "ZIP")}
          </div>
          {field("phone", "Phone", "tel")}
          {field("email", "Email", "email")}
          {field("facebookUrl", "Facebook link", "url")}
          {field("instagramUrl", "Instagram link", "url")}
        </div>
        <h3 className="mt-4 font-display text-lg text-forest">Hours shown on website</h3>
        <div className="mt-1 space-y-2">
          {b.hours.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Days (e.g. Mon–Fri)" className={`${inputCls} max-w-[180px]`} value={h.label} onChange={(e) => setB({ ...b, hours: b.hours.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input placeholder="Hours (e.g. 11 AM – 2 PM)" className={inputCls} value={h.value} onChange={(e) => setB({ ...b, hours: b.hours.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <button className="text-terracotta" aria-label="Remove" onClick={() => setB({ ...b, hours: b.hours.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <Btn variant="ghost" onClick={() => setB({ ...b, hours: [...b.hours, { label: "", value: "" }] })}>+ Add hours line</Btn>
        </div>
        <div className="mt-3 space-y-3">
          {field("hoursNote", "Hours note")}
          <label className={lbl}>Allergy notice
            <textarea rows={3} className={inputCls} value={b.allergyNotice} onChange={(e) => setB({ ...b, allergyNotice: e.target.value })} />
          </label>
        </div>
        <Btn className="mt-3" onClick={() => save("business", b, "Business info saved.")}>Save business info</Btn>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-forest">Sales tax</h2>
        <p className="text-sm text-ink/70">Maine&apos;s tax rate on prepared food is 8% at the time of setup. Confirm with your accountant and update here if it changes.</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className={lbl}>Rate (%)<input inputMode="decimal" className={`${inputCls} w-28`} value={tax.rate} onChange={(e) => setTax({ ...tax, rate: e.target.value })} /></label>
          <label className={lbl}>Label on receipts<input className={inputCls} value={tax.label} onChange={(e) => setTax({ ...tax, label: e.target.value })} /></label>
          <Btn onClick={() => save("tax", { rateBps: Math.round(Number(tax.rate) * 100), label: tax.label }, "Tax settings saved.")}>Save tax</Btn>
        </div>
      </Card>
    </div>
  );
}
