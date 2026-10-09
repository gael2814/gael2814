/** Decorative papel picado banner (traditional Mexican cut-paper flags). */
const COLORS = ["#c4562a", "#e3a52b", "#f7ecd4", "#2d5a3f", "#dc7a4f", "#f0c35e"];

export function PapelPicado({ count = 14, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`pointer-events-none flex w-full justify-between overflow-hidden ${className}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} viewBox="0 0 60 70" className="h-10 w-auto shrink-0 sm:h-14" style={{ transform: `rotate(${(i % 3) - 1}deg)` }}>
          <path
            d="M0 0 H60 V58 L54 66 L48 58 L42 66 L36 58 L30 66 L24 58 L18 66 L12 58 L6 66 L0 58 Z"
            fill={COLORS[i % COLORS.length]}
            opacity={0.95}
          />
          {/* cut-outs */}
          <g fill="#1f3d2b" opacity={0.85}>
            <circle cx="30" cy="26" r="7" />
            <path d="M30 12 l3 7 h-6 z M30 40 l3 -7 h-6 z M16 26 l7 3 v-6 z M44 26 l-7 3 v-6 z" />
            <circle cx="12" cy="10" r="2.5" />
            <circle cx="48" cy="10" r="2.5" />
            <circle cx="12" cy="44" r="2.5" />
            <circle cx="48" cy="44" r="2.5" />
            <rect x="26" y="49" width="8" height="3" rx="1.5" />
          </g>
          <rect x="0" y="0" width="60" height="3" fill="#2a1f17" opacity={0.6} />
        </svg>
      ))}
    </div>
  );
}
