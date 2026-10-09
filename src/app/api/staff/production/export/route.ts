import { route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingredientCsv, ingredientPdf, productionCsv, productionPdf } from "@/lib/export";
import { getIngredientReport, getProductionReport, type CutoffSnapshot } from "@/lib/reports/data";
import { getNow, serviceDateOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("production.view");
  const p = new URL(req.url).searchParams;
  const date = p.get("date") ?? serviceDateOf(getNow());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("Bad date", { status: 400 });
  const type = p.get("type") === "ingredients" ? "ingredients" : "production";
  const format = p.get("format") === "pdf" ? "pdf" : "csv";
  const source = p.get("source") === "snapshot" ? "snapshot" : "live";

  let production, ingredients, label;
  if (source === "snapshot") {
    const snap = await prisma.productionSnapshot.findUnique({ where: { serviceDate: date } });
    if (!snap) return new Response("No cutoff snapshot for this date yet.", { status: 404 });
    ({ production, ingredients } = snap.data as unknown as CutoffSnapshot);
    label = "Final preorder cutoff snapshot";
  } else {
    production = await getProductionReport(date);
    ingredients = await getIngredientReport(production);
    label = "Live report";
  }

  const name = `ay-ay-tacos-${type}-${date}-${source}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" };
  if (format === "csv") {
    const csv = type === "production" ? productionCsv(production) : ingredientCsv(ingredients, date);
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const pdf = type === "production" ? await productionPdf(production, label) : await ingredientPdf(ingredients, date, label);
  return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
});
