import { formatCents } from "@/lib/money";
import type { PublicCategory } from "@/lib/menu";
import { FoodPhoto } from "./FoodPhoto";

/** Printed-menu style listing of the full menu (homepage). */
export function MenuBoard({ menu }: { menu: PublicCategory[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {menu.map((cat) => (
        <section
          key={cat.id}
          aria-labelledby={`cat-${cat.slug}`}
          className={`rounded-2xl border-4 border-forest bg-cream-light p-5 shadow-stamp ${cat.slug === "signature" ? "md:col-span-2" : ""}`}
        >
          <h3 id={`cat-${cat.slug}`} className="font-display text-2xl uppercase tracking-wide text-terracotta">
            {cat.name}
            {cat.subtitle && <span className="ml-2 align-middle font-body text-sm normal-case tracking-normal text-forest/80">— {cat.subtitle}</span>}
          </h3>
          <div className="mt-1 h-1 w-16 rounded bg-mustard" />
          <ul className="mt-4 space-y-4">
            {cat.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                {item.imageUrl && (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-forest">
                    <FoodPhoto src={item.imageUrl} name={item.name} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-end">
                    <span className="font-display text-lg leading-tight text-forest">{item.name}</span>
                    <span className="leader" aria-hidden />
                    <span className="font-display text-lg text-terracotta">{formatCents(item.priceCents)}</span>
                  </div>
                  {item.description && <p className="mt-0.5 text-sm text-ink/80">{item.description}</p>}
                  {item.soldOut && <span className="mt-1 inline-block rounded bg-terracotta px-2 py-0.5 text-xs font-bold uppercase text-cream">Sold out today</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
