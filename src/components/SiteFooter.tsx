import Link from "next/link";
import type { BusinessSettings } from "@/lib/settings";

export function SiteFooter({ business }: { business: BusinessSettings }) {
  return (
    <footer className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10">
        <div className="grid gap-6 border-t-[3px] border-forest pt-6 sm:grid-cols-[1.4fr_1fr_1fr]">
          <p className="font-display text-3xl leading-tight text-forest">
            Gracias for supporting
            <br />
            <span className="text-terracotta">our small business!</span>
          </p>
          <address className="text-[15px] not-italic leading-relaxed text-ink/80">
            <span className="font-serif font-bold text-forest">Find us</span>
            <br />
            {business.addressLine1}
            <br />
            {business.city}, {business.state} {business.zip}
            {business.phone && (
              <>
                <br />
                <a className="underline" href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}>{business.phone}</a>
              </>
            )}
            {business.email && (
              <>
                <br />
                <a className="underline" href={`mailto:${business.email}`}>{business.email}</a>
              </>
            )}
          </address>
          <div className="text-[15px] text-ink/70 sm:text-right">
            <p>Good Food · Good People · Better Tacos</p>
            <div className="mt-2 flex gap-3 sm:justify-end">
              {business.facebookUrl && <a className="underline" href={business.facebookUrl} rel="noopener" target="_blank">Facebook</a>}
              {business.instagramUrl && <a className="underline" href={business.instagramUrl} rel="noopener" target="_blank">Instagram</a>}
            </div>
            <p className="mt-2 text-sm">© {new Date().getFullYear()} Ay Ay Tacos</p>
            <Link href="/staff/login" className="mt-1 inline-block text-xs opacity-60 hover:opacity-100">Staff sign in</Link>
          </div>
        </div>
      </div>
      <div className="zigzag zigzag-up" aria-hidden />
    </footer>
  );
}
