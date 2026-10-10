/* eslint-disable @next/next/no-img-element */
/**
 * Menu photo in the round, framed style of the printed menu.
 * Without a photo, a quiet patterned tile is shown instead.
 */
export function FoodPhoto({
  src,
  name,
  size,
  className = "",
  ring = "border-tan",
}: {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
  ring?: string;
}) {
  const style = size ? { width: size, height: size } : undefined;
  const frame = `shrink-0 overflow-hidden rounded-full border-[3px] ${ring} bg-cream-light p-[3px] ${className}`;
  if (src)
    return (
      <div className={frame} style={style}>
        <img src={src} alt={name} loading="lazy" className="h-full w-full rounded-full object-cover" />
      </div>
    );
  return (
    <div className={frame} style={style} role="img" aria-label={name}>
      <div className="bg-talavera-light flex h-full w-full items-center justify-center rounded-full">
        <span className="text-2xl text-terracotta/50" aria-hidden>✦</span>
      </div>
    </div>
  );
}
