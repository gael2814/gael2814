import { json, route } from "@/lib/api";
import { cartSchema, quoteOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const { items } = cartSchema.parse(await req.json());
  const q = await quoteOrder(items);
  return json({
    lines: q.lines.map(({ menuItemId, name, unitCents, quantity }) => ({ menuItemId, name, unitCents, quantity })),
    subtotalCents: q.subtotalCents,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
    taxRateBps: q.taxRateBps,
    pickupOptions: q.pickupOptions.slice(0, 8),
  });
});
