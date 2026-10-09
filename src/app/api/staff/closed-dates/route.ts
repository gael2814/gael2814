import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("schedule.manage");
  const { date, reason } = z.object({ date: z.string().regex(dateRe), reason: z.string().max(120).optional() }).parse(await req.json());
  const row = await prisma.closedDate.upsert({ where: { date }, create: { date, reason: reason || null }, update: { reason: reason || null } });
  return json(row);
});

export const DELETE = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("schedule.manage");
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!dateRe.test(date)) return json({ error: "Bad date" }, 400);
  await prisma.closedDate.deleteMany({ where: { date } });
  return json({ ok: true });
});
