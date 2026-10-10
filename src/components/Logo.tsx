/* eslint-disable @next/next/no-img-element */
/** Official Ay Ay Tacos moose logo. An uploaded replacement (Admin → Business) takes priority. */
export const DEFAULT_LOGO = "/brand/logo.png";

export function Logo({ logoUrl, size = 64, className = "" }: { logoUrl?: string | null; size?: number; className?: string }) {
  return (
    <img
      src={logoUrl || DEFAULT_LOGO}
      alt="Ay Ay Tacos"
      width={size}
      height={Math.round(size * 1.08)}
      className={`object-contain ${className}`}
      style={{ width: /\bw-/.test(className) ? undefined : size, height: "auto" }}
    />
  );
}
