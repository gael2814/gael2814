import { prisma } from "./db";
import { getNow, serviceDateOf } from "./time";
import { ACTIVE_PAID_STATUSES } from "./orders";

export type PublicMenuItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  featured: boolean;
  preorderable: boolean;
  soldOut: boolean;
  remaining: number | null;
  tacosPerItem: number;
};

export type PublicCategory = { id: string; slug: string; name: string; subtitle: string | null; items: PublicMenuItem[] };

export const imageUrl = (id: string | null | undefined) => (id ? `/api/images/${id}` : null);

/** Menu for the public site, with today's remaining quantities for limited items. */
export async function getPublicMenu(): Promise<PublicCategory[]> {
  const now = getNow();
  const serviceDate = serviceDateOf(now);
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { items: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  const limited = cats.flatMap((c) => c.items).filter((i) => i.dailyLimit != null);
  const sold = new Map<string, number>();
  if (limited.length) {
    const rows = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { in: limited.map((i) => i.id) },
        order: {
          serviceDate,
          OR: [{ status: { in: ACTIVE_PAID_STATUSES } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
        },
      },
      _sum: { quantity: true },
    });
    for (const r of rows) sold.set(r.menuItemId, r._sum.quantity ?? 0);
  }
  return cats
    .filter((c) => c.items.length > 0)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      subtitle: c.subtitle,
      items: c.items.map((i) => {
        const remaining = i.dailyLimit != null ? Math.max(0, i.dailyLimit - (sold.get(i.id) ?? 0)) : null;
        return {
          id: i.id,
          slug: i.slug,
          name: i.name,
          description: i.description,
          priceCents: i.priceCents,
          imageUrl: imageUrl(i.imageId),
          featured: i.featured,
          preorderable: i.preorderable,
          soldOut: i.soldOut || remaining === 0,
          remaining,
          tacosPerItem: i.tacosPerItem,
        };
      }),
    }));
}
