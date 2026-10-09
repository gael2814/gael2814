/* eslint-disable @next/next/no-img-element */
/**
 * Shows the official Ay Ay Tacos logo uploaded in Admin → Business settings.
 * Until it is uploaded, a plain text wordmark is shown (no substitute logo).
 */
export function Logo({ logoUrl, size = "md", light = true }: { logoUrl: string | null; size?: "sm" | "md" | "lg"; light?: boolean }) {
  const px = { sm: 44, md: 64, lg: 180 }[size];
  if (logoUrl)
    return <img src={logoUrl} alt="Ay Ay Tacos logo" width={px} height={px} className="object-contain" style={{ width: px, height: px }} />;
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-5xl sm:text-7xl" }[size];
  return (
    <span className={`font-western ${text} leading-none tracking-wide ${light ? "text-mustard" : "text-forest"}`} aria-label="Ay Ay Tacos">
      AY AY <span className={light ? "text-cream" : "text-terracotta"}>TACOS</span>
    </span>
  );
}
