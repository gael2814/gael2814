import { formatCents } from "@/lib/money";
import type { PublicCategory, PublicMenuItem } from "@/lib/menu";
import { FoodPhoto } from "./FoodPhoto";

/**
 * The full menu laid out like the printed Ay Ay Tacos menu. Every price,
 * description and photo comes from the database, so admin edits show up here.
 */
export function MenuBoard({ menu, skipItemIds = [] }: { menu: PublicCategory[]; skipItemIds?: string[] }) {
  const cats = menu
    .map((c) => ({ ...c, items: c.items.filter((i) => !skipItemIds.includes(i.id)) }))
    .filter((c) => c.items.length > 0);

  // Group consecutive "column" categories so they sit side by side like the printed menu.
  const blocks: (PublicCategory | PublicCategory[])[] = [];
  for (const c of cats) {
    if (layoutOf(c) === "column") {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(c);
      else blocks.push([c]);
    } else blocks.push(c);
  }

  return (
    <div className="space-y-12">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <div key={i} className="mx-auto grid max-w-6xl gap-x-14 gap-y-10 px-4 md:grid-cols-2">
            {b.map((c) => (
              <ColumnCategory key={c.id} cat={c} />
            ))}
          </div>
        ) : (
          <BlockCategory key={b.id} cat={b} />
        ),
      )}
    </div>
  );
}

type Layout = "wide" | "tacos" | "family" | "kids" | "column";
function layoutOf(c: PublicCategory): Layout {
  if (c.slug === "favorites" || c.slug === "signature") return "wide";
  if (c.slug === "large-tacos") return "tacos";
  if (c.slug === "family-meals") return "family";
  if (c.slug === "kids") return "kids";
  return "column";
}

function Heading({ cat, light = false }: { cat: PublicCategory; light?: boolean }) {
  return (
    <h3 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className={`font-display text-4xl sm:text-5xl ${light ? "text-mustard" : "text-terracotta"}`}>{cat.name}</span>
      {cat.subtitle && <span className={`font-serif text-lg font-semibold italic ${light ? "text-cream/80" : "text-ink/60"}`}>{cat.subtitle}</span>}
    </h3>
  );
}

function SoldOut({ item }: { item: PublicMenuItem }) {
  if (!item.soldOut) return null;
  return <span className="mt-1 inline-block rounded bg-terracotta px-2 py-0.5 text-xs font-bold uppercase text-cream">Sold out today</span>;
}

function MenuLine({ item, photoSize = 96 }: { item: PublicMenuItem; photoSize?: number }) {
  return (
    <li className="flex items-start gap-4">
      {item.imageUrl && <FoodPhoto src={item.imageUrl} name={item.name} size={photoSize} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-end">
          <span className="font-serif text-xl font-bold leading-tight text-ink sm:text-2xl">
            {item.name}
            {item.pronunciation && <span className="ml-2 align-middle font-serif text-sm font-semibold italic text-ink/55">{item.pronunciation}</span>}
          </span>
          <span className="leader" aria-hidden />
          <span className="font-display text-xl text-brick sm:text-2xl">{formatCents(item.priceCents)}</span>
        </div>
        {item.description && <p className="mt-1 text-[17px] leading-snug text-ink/80">{item.description}</p>}
        <SoldOut item={item} />
      </div>
    </li>
  );
}

function ColumnCategory({ cat }: { cat: PublicCategory }) {
  return (
    <section aria-label={cat.name}>
      <Heading cat={cat} />
      <ul className="mt-5 space-y-5">
        {cat.items.map((i) => (
          <MenuLine key={i.id} item={i} photoSize={88} />
        ))}
      </ul>
    </section>
  );
}

function BlockCategory({ cat }: { cat: PublicCategory }) {
  const layout = layoutOf(cat);

  if (layout === "tacos") {
    const prices = [...new Set(cat.items.map((i) => i.priceCents))];
    const same = prices.length === 1;
    return (
      <section aria-label={cat.name} className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Heading cat={cat} light />
            {same && (
              <p className="font-display text-5xl text-cream">
                {formatCents(prices[0])} <span className="font-serif text-lg font-semibold italic text-cream/80">each</span>
              </p>
            )}
          </div>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {cat.items.map((i) => (
              <li key={i.id} className="border-t-[3px] border-cream/30 pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-2xl font-bold">{i.name}</span>
                  {!same && <span className="font-display text-xl text-mustard">{formatCents(i.priceCents)}</span>}
                </div>
                {i.description && <p className="mt-1 text-[17px] leading-snug text-cream/85">{i.description}</p>}
                <SoldOut item={i} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (layout === "family") {
    return (
      <section aria-label={cat.name} className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
          {cat.items.map((i) => {
            const [lead, ...rest] = i.description.split(". ");
            const hasLead = rest.length > 0 && lead.includes("+");
            return (
              <div key={i.id} className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
                <div>
                  {cat.subtitle && <p className="font-serif text-xl font-bold italic text-mustard">{cat.subtitle}</p>}
                  <h3 className="mt-1 font-display text-5xl leading-[1.05] sm:text-6xl">{i.name}</h3>
                  <p className="mt-2 font-display text-6xl text-mustard sm:text-7xl">{formatCents(i.priceCents)}</p>
                  {hasLead ? (
                    <>
                      <p className="mt-3 font-serif text-2xl font-bold">{lead}</p>
                      <p className="mt-2 text-lg text-cream/85">{rest.join(". ")}</p>
                    </>
                  ) : (
                    i.description && <p className="mt-3 text-lg text-cream/85">{i.description}</p>
                  )}
                  <SoldOut item={i} />
                </div>
                <FoodPhoto src={i.imageUrl} name={i.name} ring="border-mustard" className="mx-auto aspect-square w-full max-w-[420px]" />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (layout === "kids") {
    return (
      <div className="mx-auto max-w-6xl px-4">
        <section aria-label={cat.name} className="ml-auto bg-mustard p-6 text-ink md:w-1/2">
          {cat.items.map((i) => (
            <div key={i.id}>
              <div className="flex items-end">
                <span className="font-serif text-2xl font-bold">{i.name}</span>
                <span className="leader !border-ink/40" aria-hidden />
                <span className="font-display text-2xl">{formatCents(i.priceCents)}</span>
              </div>
              {i.description && <p className="mt-1 text-lg">{i.description}</p>}
              <SoldOut item={i} />
            </div>
          ))}
        </section>
      </div>
    );
  }

  // wide: two-column list with photos (Favorites)
  return (
    <section aria-label={cat.name} className="mx-auto max-w-6xl px-4">
      <Heading cat={cat} />
      <ul className="mt-6 grid gap-x-14 gap-y-7 md:grid-cols-2">
        {cat.items.map((i) => (
          <MenuLine key={i.id} item={i} />
        ))}
      </ul>
    </section>
  );
}
