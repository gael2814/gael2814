import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProductionReport } from "./reports/production";
import { dishSummaryLine } from "./reports/production";
import { formatAmount, type IngredientReport } from "./reports/ingredients";
import { formatDate, formatTime } from "./time";

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function productionCsv(r: ProductionReport): string {
  const rows: (string | number)[][] = [
    ["Ay Ay Tacos — Kitchen Production Report"],
    ["Service date", r.serviceDate],
    ["Generated", r.generatedAt],
    [],
    ["Dish", "Quantity", "Individual tacos"],
    ...r.dishes.map((d) => [d.name, d.quantity, d.tacos || ""]),
    ["TOTAL", r.totals.items, r.totals.tacos || ""],
    [],
    ["Orders", r.totals.orders],
    ["Workload units (1 = 1 quesabirria order)", r.totals.units],
    [],
    ["Pickup time", "Orders", "Workload units", "Dishes"],
    ...r.slots.filter((s) => s.orders > 0).map((s) => [formatTime(s.at), s.orders, s.units, s.dishes.map((d) => `${d.quantity}x ${d.name}`).join("; ")]),
    [],
    ["Status", "Orders"],
    ...Object.entries(r.statusCounts).map(([k, v]) => [k, v]),
  ];
  return toCsv(rows);
}

export function ingredientCsv(r: IngredientReport, serviceDate: string): string {
  const rows: (string | number)[][] = [
    ["Ay Ay Tacos — Ingredient Preparation Report"],
    ["Service date", serviceDate],
    [],
    ["Ingredient", "Prepared amount", "Unit", "Raw amount (from yield)", "Yield %", "Used in"],
    ...r.ingredients.map((i) => [
      i.name,
      i.quantity,
      i.unit,
      i.rawQuantity ?? "",
      i.yieldPercent ?? "",
      i.breakdown.map((b) => `${b.dish} x${b.dishQuantity}: ${b.quantity}`).join("; "),
    ]),
  ];
  if (r.missingRecipes.length) {
    rows.push([], ["Dishes without a recipe (not included above)"], ...r.missingRecipes.map((m) => [m.name, m.quantity]));
  }
  return toCsv(rows);
}

// ---------- PDF ----------

const GREEN = rgb(0.12, 0.24, 0.17);
const TERRA = rgb(0.77, 0.34, 0.16);
const GREY = rgb(0.35, 0.3, 0.27);

// Standard PDF fonts only support WinAnsi characters.
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "");

class PdfWriter {
  page!: PDFPage;
  y = 0;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public title: string) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([612, 792]);
    this.y = 750;
    this.page.drawRectangle({ x: 0, y: 772, width: 612, height: 20, color: GREEN });
    this.page.drawText(safe("AY AY TACOS  ·  " + this.title), { x: 40, y: 778, size: 9, font: this.bold, color: rgb(0.97, 0.93, 0.83) });
  }
  ensure(h: number) {
    if (this.y - h < 50) this.newPage();
  }
  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) {
    const size = opts.size ?? 11;
    this.ensure(size + 6);
    this.page.drawText(safe(s), { x: opts.x ?? 40, y: this.y, size, font: opts.bold ? this.bold : this.font, color: opts.color ?? rgb(0.16, 0.12, 0.09), maxWidth: 530 });
    this.y -= size + (opts.gap ?? 6);
  }
  row(cols: string[], widths: number[], opts: { bold?: boolean; size?: number } = {}) {
    const size = opts.size ?? 10;
    this.ensure(size + 6);
    let x = 40;
    cols.forEach((c, i) => {
      let t = safe(c);
      const f = opts.bold ? this.bold : this.font;
      while (t.length > 1 && f.widthOfTextAtSize(t, size) > widths[i] - 6) t = t.slice(0, -2) + "…";
      this.page.drawText(safe(t), { x, y: this.y, size, font: f });
      x += widths[i];
    });
    this.y -= size + 6;
  }
  rule() {
    this.ensure(8);
    this.page.drawLine({ start: { x: 40, y: this.y + 4 }, end: { x: 572, y: this.y + 4 }, thickness: 0.6, color: GREY });
    this.y -= 6;
  }
}

async function writer(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ay Ay Tacos - ${title}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return new PdfWriter(doc, font, bold, title);
}

export async function productionPdf(r: ProductionReport, label: string): Promise<Uint8Array> {
  const w = await writer("Kitchen Production Report");
  w.text("LUNCH PRODUCTION SUMMARY", { size: 18, bold: true, color: TERRA });
  w.text(`${formatDate(r.serviceDate)} — ${label}`, { size: 11, color: GREY, gap: 12 });
  w.text(`${r.totals.orders} orders · ${r.totals.items} items · ${r.totals.tacos} individual tacos · ${r.totals.units} workload units`, { bold: true, gap: 10 });
  for (const d of r.dishes) w.text(dishSummaryLine(d), { size: 13 });
  if (!r.dishes.length) w.text("No paid orders.", { color: GREY });
  w.y -= 8;
  w.text("BY PICKUP TIME", { size: 13, bold: true, color: GREEN });
  w.row(["Pickup", "Orders", "Units", "Dishes"], [70, 50, 50, 362], { bold: true });
  w.rule();
  for (const s of r.slots.filter((s) => s.orders > 0))
    w.row([formatTime(s.at), String(s.orders), String(s.units), s.dishes.map((d) => `${d.quantity}x ${d.name}`).join(", ")], [70, 50, 50, 362]);
  w.y -= 8;
  w.text("ORDER STATUS", { size: 13, bold: true, color: GREEN });
  w.text(Object.entries(r.statusCounts).map(([k, v]) => `${k.replace("_", " ")}: ${v}`).join("   "));
  if (r.cancelled.orders) w.text(`Cancelled items (do not prepare): ${r.cancelled.dishes.map((d) => `${d.quantity}x ${d.name}`).join(", ")}`, { color: TERRA });
  w.y -= 6;
  w.text(`Generated ${new Date(r.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })}`, { size: 8, color: GREY });
  return w.doc.save();
}

export async function ingredientPdf(r: IngredientReport, serviceDate: string, label: string): Promise<Uint8Array> {
  const w = await writer("Ingredient Preparation Report");
  w.text("INGREDIENT PREPARATION", { size: 18, bold: true, color: TERRA });
  w.text(`${formatDate(serviceDate)} — ${label}`, { size: 11, color: GREY, gap: 12 });
  w.row(["Ingredient", "Prepared", "Raw (yield)", "Used in"], [150, 110, 100, 172], { bold: true });
  w.rule();
  for (const i of r.ingredients)
    w.row(
      [i.name, formatAmount(i.quantity, i.unit), i.rawQuantity != null ? formatAmount(i.rawQuantity, i.unit) : "—", i.breakdown.map((b) => `${b.dish} ×${b.dishQuantity}`).join(", ")],
      [150, 110, 100, 172],
    );
  if (!r.ingredients.length) w.text("No ingredients to calculate.", { color: GREY });
  if (r.missingRecipes.length) {
    w.y -= 8;
    w.text("No recipe configured (not calculated):", { bold: true, color: TERRA });
    w.text(r.missingRecipes.map((m) => `${m.quantity}x ${m.name}`).join(", "), { size: 10 });
  }
  return w.doc.save();
}
