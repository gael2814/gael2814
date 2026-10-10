import { json } from "@/lib/api";
import { ensureCutoffSnapshot } from "@/lib/reports/data";
import { sweepExpiredHolds } from "@/lib/orders";
import { getNow, serviceDateOf } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Scheduled job (see vercel.json). Releases abandoned payment holds and
 * creates the final preorder cutoff snapshot once preorders close.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const released = await sweepExpiredHolds();
  const snapshot = await ensureCutoffSnapshot(serviceDateOf(getNow()));
  return json({ released, snapshot: snapshot ? "ready" : "not yet (before cutoff)" });
}
