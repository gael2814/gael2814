import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { getKitchenBoard } from "@/lib/kitchen";
import { getNow, serviceDateOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("kitchen.view");
  const date = new URL(req.url).searchParams.get("date") ?? serviceDateOf(getNow());
  return json(await getKitchenBoard(date));
});
