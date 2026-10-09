import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureCutoffSnapshot, getIngredientReport, getProductionReport } from "@/lib/reports/data";
import { getNow, serviceDateOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("production.view");
  const date = new URL(req.url).searchParams.get("date") ?? serviceDateOf(getNow());
  const production = await getProductionReport(date);
  const ingredients = await getIngredientReport(production);
  const isToday = date === serviceDateOf(getNow());
  const snapshot = isToday
    ? await ensureCutoffSnapshot(date)
    : ((await prisma.productionSnapshot.findUnique({ where: { serviceDate: date } }))?.data ?? null);
  return json({ production, ingredients, snapshot });
});
