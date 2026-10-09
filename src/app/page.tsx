import Link from "next/link";
import { getPublicMenu, imageUrl } from "@/lib/menu";
import { getCurrentPreorderStatus } from "@/lib/public-status";
import { formatCents } from "@/lib/money";
import { formatHHmm, WEEKDAYS } from "@/lib/time";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
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
        {/* HERO — mirrors the top of the printed menu */}
        <section className="bg-cream">
          <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-12 pt-8 sm:grid-cols-[auto_1fr] sm:gap-10 sm:pt-12">
            <Logo logoUrl={logoUrl} size={230} className="mx-auto w-40 sm:w-[230px]" />
            <div className="text-center sm:text-left">
              <h1 className="font-display text-4xl leading-[1.08] text-forest sm:text-5xl lg:text-6xl">{b.tagline}</h1>
              <p className="mt-3 font-serif text-xl font-bold italic text-terracotta sm:text-2xl">
                New to Mexican food? Every dish has a short note telling you what&apos;s in it.
              </p>
              <p className="mt-2 text-lg text-ink/70">
                {b.addressLine1} · {b.city}, {b.state} · Dine in or takeout
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/order"
                  className="rounded-full bg-terracotta px-9 py-4 font-display text-2xl uppercase tracking-wider text-cream shadow-[5px_5px_0_0_#1f3d2b] transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
                >
                  Preorder Lunch
                </Link>
                <PreorderBadge status={status} schedule={s} />
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED — "Our most popular dish. Start here!" */}
        {featured && (
          <section className="bg-terracotta text-cream" aria-labelledby="featured-h">
            <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[minmax(0,420px)_1fr] md:gap-12">
              <FoodPhoto src={featured.imageUrl} name={featured.name} ring="border-cream" className="mx-auto aspect-square w-full max-w-[420px] bg-ink/90" />
              <div>
                <p className="font-serif text-xl font-bold italic text-mustard-light">Our most popular dish. Start here!</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-x-6">
                  <h2 id="featured-h" className="font-display text-4xl leading-[1.05] sm:text-5xl">{featured.name}</h2>
                  <span className="font-display text-6xl text-mustard-light">{formatCents(featured.priceCents)}</span>
                </div>
                {featured.pronunciation && <p className="mt-1 font-serif text-lg font-semibold italic text-cream/85">{featured.pronunciation}</p>}
                <p className="mt-3 text-xl leading-snug">{featured.description}</p>
                <ol className="mt-6 grid grid-cols-3 gap-4">
                  {[
                    ["Dip", "the taco in the warm broth"],
                    ["Bite", "crispy, cheesy, juicy"],
                    ["Repeat", "sip the broth at the end"],
                  ].map(([t, d], i) => (
                    <li key={t} className="border-t-[3px] border-cream/50 pt-2">
                      <span className="font-display text-xl">{i + 1}. {t}</span>
                      <span className="block text-[15px] leading-snug text-cream/90">{d}</span>
                    </li>
                  ))}
                </ol>
                <Link href="/order" className="mt-7 inline-block rounded-full bg-cream px-7 py-3 font-display uppercase tracking-wide text-terracotta-dark hover:bg-cream-light">
                  Preorder yours →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-24 bg-forest text-cream">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="font-serif text-xl font-bold italic text-mustard">Skip the wait</p>
            <h2 className="font-display text-4xl sm:text-5xl">How Online Pickup Works</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Order in the morning", `Preorders open at ${formatHHmm(s.preorderOpen)} and close at ${formatHHmm(s.preorderClose)}${days.length ? ` (${days.join(", ")})` : ""}.`],
                ["Get your pickup time", "We give you a realistic pickup time based on what our kitchen is already cooking."],
                ["Pay securely", "Pay online with card, Apple Pay or Google Pay. You'll get an email with your order number."],
                [`Pick up at ${b.addressLine1}`, `Lunch pickup starts at ${formatHHmm(s.pickupStart)}. Just give us your order number.`],
              ].map(([title, text], i) => (
                <li key={title} className="border-t-[3px] border-cream/30 pt-3">
                  <span className="font-display text-4xl text-mustard">{i + 1}.</span>
                  <h3 className="mt-1 font-serif text-2xl font-bold">{title}</h3>
                  <p className="mt-1 text-[17px] text-cream/85">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* MENU */}
        <section id="menu" className="scroll-mt-24 bg-cream pb-14">
          <div className="zigzag" aria-hidden />
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 text-center">
            <h2 className="font-display text-5xl text-forest sm:text-6xl">Our Menu</h2>
            <p className="mt-2 font-serif text-xl font-bold italic text-terracotta">Something to share, something to sip, something sweet.</p>
          </div>
          <MenuBoard menu={menu} skipItemIds={featured ? [featured.id] : []} />
          <div className="mx-auto mt-12 max-w-6xl px-4">
            <div className="border-2 border-dashed border-terracotta/60 bg-cream-light p-4 text-[15px]" role="note">
              <strong className="font-serif text-terracotta">Allergy information: </strong>
              {b.allergyNotice}
            </div>
            <div className="mt-8 text-center">
              <Link href="/order" className="inline-block rounded-full bg-terracotta px-9 py-4 font-display text-xl uppercase tracking-wide text-cream shadow-[5px_5px_0_0_#1f3d2b] hover:bg-terracotta-dark">
                Preorder Lunch
              </Link>
            </div>
          </div>
        </section>

        {/* VISIT */}
        <section id="visit" className="scroll-mt-20 bg-forest text-cream">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
            <div>
              <h2 className="font-display text-4xl text-mustard sm:text-5xl">Visit Us</h2>
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

              <h3 className="mt-8 font-serif text-2xl font-bold text-mustard">Hours</h3>
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
                  <h3 className="mt-8 font-serif text-2xl font-bold text-mustard">Contact</h3>
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-mustard bg-cream p-3 sm:hidden">
        <Link href="/order" className="block rounded-full bg-terracotta py-3 text-center font-display text-lg uppercase tracking-wide text-cream">
          Preorder Lunch
        </Link>
      </div>
      <div className="h-20 sm:hidden" aria-hidden />
    </>
  );
}
