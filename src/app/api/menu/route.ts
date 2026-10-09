import { json, route } from "@/lib/api";
import { getPublicMenu } from "@/lib/menu";
import { getCurrentPreorderStatus } from "@/lib/public-status";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const [menu, { status }] = await Promise.all([getPublicMenu(), getCurrentPreorderStatus()]);
  return json({ menu, preorder: status });
});
