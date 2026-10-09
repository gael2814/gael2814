import Link from "next/link";
import type { BusinessSettings } from "@/lib/settings";

export function SiteFooter({ business }: { business: BusinessSettings }) {
  return (
    <footer className="bg-forest text-cream">
      <div className="serape" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="font-western text-2xl text-mustard">Ay Ay Tacos</div>
          <p className="mt-2 text-sm italic opacity-90">{business.tagline}</p>
        </div>
        <address className="not-italic text-sm leading-relaxed">
          <div className="font-display text-mustard">Find us</div>
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
        <div className="text-sm sm:text-right">
          <div className="flex gap-3 sm:justify-end">
            {business.facebookUrl && <a className="underline" href={business.facebookUrl} rel="noopener" target="_blank">Facebook</a>}
            {business.instagramUrl && <a className="underline" href={business.instagramUrl} rel="noopener" target="_blank">Instagram</a>}
          </div>
          <p className="mt-3 opacity-70">© {new Date().getFullYear()} Ay Ay Tacos · Caribou, Maine</p>
          <Link href="/staff/login" className="mt-2 inline-block text-xs opacity-50 hover:opacity-100">Staff sign in</Link>
        </div>
      </div>
    </footer>
  );
}
