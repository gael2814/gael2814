import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings, saveSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("schedule.manage");
  const [settings, closedDates] = await Promise.all([getSettings(), prisma.closedDate.findMany({ orderBy: { date: "asc" } })]);
  return json({ settings, closedDates });
});

const PERM = { schedule: "schedule.manage", kitchen: "schedule.manage", business: "business.manage", tax: "business.manage" } as const;

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  const { key, value } = z.object({ key: z.enum(["schedule", "kitchen", "business", "tax"]), value: z.record(z.unknown()) }).parse(await req.json());
  await requirePermission(PERM[key]);
  return json(await saveSetting(key, value));
});
