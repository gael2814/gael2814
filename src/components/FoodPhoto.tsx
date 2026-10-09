/* eslint-disable @next/next/no-img-element */
/** Menu photo uploaded by the owner, or a decorative tile until a photo is added. */
export function FoodPhoto({ src, name, className = "", showName = true }: { src: string | null; name: string; className?: string; showName?: boolean }) {
  if (src) return <img src={src} alt={name} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`bg-talavera flex h-full w-full items-center justify-center p-3 ${className}`} role="img" aria-label={name}>
      {showName ? (
        <span className="rounded-lg bg-forest/80 px-3 py-1 text-center font-western text-lg leading-tight text-mustard">{name}</span>
      ) : (
        <span className="text-3xl text-mustard/70" aria-hidden>✦</span>
      )}
    </div>
  );
}
