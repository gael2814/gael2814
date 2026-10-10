import { appUrl, json, route } from "@/lib/api";
import { checkoutSchema, createCheckout } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const input = checkoutSchema.parse(await req.json());
  const result = await createCheckout(input, appUrl(req));
  return json(result);
});
