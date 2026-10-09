import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader({ logoUrl, showOrderButton = true }: { logoUrl: string | null; showOrderButton?: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-forest text-cream shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2" aria-label="Ay Ay Tacos home">
          <Logo logoUrl={logoUrl} size="sm" />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-4" aria-label="Main">
          <Link href="/#menu" className="hidden rounded px-2 py-1 hover:text-mustard sm:inline">Menu</Link>
          <Link href="/#how" className="hidden rounded px-2 py-1 hover:text-mustard sm:inline">How Pickup Works</Link>
          <Link href="/#visit" className="hidden rounded px-2 py-1 hover:text-mustard md:inline">Visit Us</Link>
          {showOrderButton && (
            <Link
              href="/order"
              className="rounded-full border-2 border-cream bg-terracotta px-4 py-2 font-display text-sm uppercase tracking-wide text-cream shadow-stamp-sm transition hover:bg-terracotta-dark"
            >
              Preorder Lunch
            </Link>
          )}
        </nav>
      </div>
      <div className="serape" />
    </header>
  );
}
