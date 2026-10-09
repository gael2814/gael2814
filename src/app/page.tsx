import Link from "next/link";
import { getPublicMenu, imageUrl } from "@/lib/menu";
import { getCurrentPreorderStatus } from "@/lib/public-status";
import { formatCents } from "@/lib/money";
import { formatHHmm, WEEKDAYS } from "@/lib/time";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PapelPicado } from "@/components/PapelPicado";
import { Logo } from "@/components/Logo";
import { PreorderBadge } from "@/components/PreorderBadge";
import { MenuBoard } from "@/components/MenuBoard";
import { FoodPhoto } from "@/components/FoodPhoto";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ settings, status }, menu] = await Promise.all([getCurrentPreorderStatus(), getPublicMenu()]);
  const b = settings.business;
  const s = settings.schedule;
  const logoUrl = imageUrl(b.logoImageId);
  const featured = menu.flatMap((c) => c.items).find((i) => i.featured);
  const address = `${b.addressLine1}, ${b.city}, ${b.state}${b.zip ? " " + b.zip : ""}`;
  const mapsQuery = encodeURIComponent(address);
  const days = WEEKDAYS.filter((d) => s.operatingDays.includes(d.value)).map((d) => d.label);

  return (
    <>
      <SiteHeader logoUrl={logoUrl} />
      <main id="main">
        {/* HERO */}
        <section className="bg-talavera relative overflow-hidden text-cream">
          <PapelPicado count={16} className="absolute inset-x-0 top-0" />
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-14 pt-20 text-center sm:pt-24">
            <Logo logoUrl={logoUrl} size="lg" />
            <h1 className="mt-6 max-w-3xl font-display text-3xl leading-tight text-shadow-stamp sm:text-5xl">
              {b.tagline}
            </h1>
            <div className="mt-6">
              <PreorderBadge status={status} schedule={s} />
            </div>
            <Link
              href="/order"
              className="mt-6 inline-block rounded-full border-4 border-cream bg-terracotta px-10 py-4 font-display text-2xl uppercase tracking-wider text-cream shadow-[6px_6px_0_0_#e3a52b] transition hover:-translate-y-0.5 hover:bg-terracotta-dark sm:text-3xl"
            >
              Preorder Lunch
            </Link>
            <p className="mt-4 text-sm opacity-90">
              Order {formatHHmm(s.preorderOpen)}–{formatHHmm(s.preorderClose)} · Pickup from {formatHHmm(s.pickupStart)} · {b.addressLine1}, {b.city}
            </p>
          </div>
        </section>

        {/* FEATURED */}
        {featured && (
          <section className="bg-talavera-light">
            <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2">
              <div className="aspect-[4/3] overflow-hidden rounded-3xl border-4 border-forest shadow-stamp">
                <FoodPhoto src={featured.imageUrl} name={featured.name} />
              </div>
              <div>
                <p className="font-western text-xl text-terracotta">Our Signature Dish</p>
                <h2 className="mt-1 font-display text-4xl leading-tight text-forest sm:text-5xl">{featured.name}</h2>
                <p className="mt-4 text-lg">{featured.description}</p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <span className="rounded-xl bg-mustard px-4 py-2 font-display text-3xl text-forest shadow-stamp-sm">{formatCents(featured.priceCents)}</span>
                  <Link href="/order" className="rounded-full bg-forest px-6 py-3 font-display uppercase tracking-wide text-cream hover:bg-forest-light">
                    Preorder yours →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-20 bg-terracotta text-cream">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-center font-display text-3xl uppercase tracking-wide sm:text-4xl">How Online Pickup Works</h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Order in the morning", `Preorders open at ${formatHHmm(s.preorderOpen)} and close at ${formatHHmm(s.preorderClose)}${days.length ? ` (${days.join(", ")})` : ""}.`],
                ["Get your pickup time", "We give you a realistic pickup time based on what our kitchen is already cooking."],
                ["Pay securely", "Pay online with card, Apple Pay or Google Pay. You'll get an email with your order number."],
                ["Pick up at 117 Sweden St.", `Lunch pickup starts at ${formatHHmm(s.pickupStart)}. Just give us your order number.`],
              ].map(([title, text], i) => (
                <li key={title} className="rounded-2xl border-4 border-cream bg-forest p-5 shadow-[4px_4px_0_0_#e3a52b]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-mustard font-display text-xl text-forest">{i + 1}</div>
                  <h3 className="mt-3 font-display text-xl">{title}</h3>
                  <p className="mt-1 text-sm opacity-90">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* MENU */}
        <section id="menu" className="bg-talavera-light scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="text-center">
              <p className="font-western text-xl text-terracotta">Hecho a mano</p>
              <h2 className="font-display text-4xl uppercase tracking-wide text-forest sm:text-5xl">Our Menu</h2>
            </div>
            <div className="mt-8">
              <MenuBoard menu={menu} />
            </div>
            <div className="mt-8 rounded-2xl border-2 border-dashed border-terracotta bg-cream-light p-4 text-sm" role="note">
              <strong className="font-display text-terracotta">Allergy information: </strong>
              {b.allergyNotice}
            </div>
            <div className="mt-8 text-center">
              <Link href="/order" className="inline-block rounded-full bg-terracotta px-8 py-3 font-display text-xl uppercase tracking-wide text-cream shadow-stamp hover:bg-terracotta-dark">
                Preorder Lunch
              </Link>
            </div>
          </div>
        </section>

        {/* VISIT */}
        <section id="visit" className="scroll-mt-20 bg-forest text-cream">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl uppercase tracking-wide text-mustard sm:text-4xl">Visit Us</h2>
              <address className="mt-4 text-xl not-italic leading-relaxed">
                {b.addressLine1}
                <br />
                {b.city}, {b.state} {b.zip}
              </address>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-block rounded-full bg-mustard px-5 py-2 font-display text-forest hover:bg-mustard-light"
              >
                Get directions
              </a>

              <h3 className="mt-8 font-display text-2xl text-mustard">Hours</h3>
              {b.hours.length > 0 ? (
                <dl className="mt-2 grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                  {b.hours.map((h, i) => (
                    <div key={i} className="contents">
                      <dt className="font-semibold">{h.label}</dt>
                      <dd>{h.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 opacity-90">Hours will be posted soon.</p>
              )}
              {b.hoursNote && <p className="mt-2 text-sm opacity-90">{b.hoursNote}</p>}

              {(b.phone || b.email) && (
                <>
                  <h3 className="mt-8 font-display text-2xl text-mustard">Contact</h3>
                  <p className="mt-2 space-y-1">
                    {b.phone && (
                      <a className="block underline" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a>
                    )}
                    {b.email && (
                      <a className="block underline" href={`mailto:${b.email}`}>{b.email}</a>
                    )}
                  </p>
                </>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border-4 border-mustard">
              <iframe
                title="Map to Ay Ay Tacos"
                src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                className="h-80 w-full md:h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter business={b} />
      {/* Mobile sticky order button */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-mustard bg-forest p-3 sm:hidden">
        <Link href="/order" className="block rounded-full bg-terracotta py-3 text-center font-display text-lg uppercase tracking-wide text-cream">
          Preorder Lunch
        </Link>
      </div>
      <div className="h-20 sm:hidden" aria-hidden />
    </>
  );
}
