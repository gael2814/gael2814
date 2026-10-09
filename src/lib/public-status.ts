import { prisma } from "./db";
import { getPreorderStatus } from "./preorder-window";
import { getSettings } from "./settings";
import { getNow } from "./time";

export async function getCurrentPreorderStatus() {
  const [settings, closed] = await Promise.all([getSettings(), prisma.closedDate.findMany({ select: { date: true } })]);
  return {
    settings,
    status: getPreorderStatus(
      getNow(),
      settings.schedule,
      closed.map((c) => c.date),
    ),
  };
}
