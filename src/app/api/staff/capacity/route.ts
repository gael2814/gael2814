import { json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { getKitchenBoard } from "@/lib/kitchen";
import { getNow, serviceDateOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requirePermission("production.view");
  const date = new URL(req.url).searchParams.get("date") ?? serviceDateOf(getNow());
  const board = await getKitchenBoard(date);
  return json({ slots: board.slots, pendingPayments: board.pendingPayments });
});
