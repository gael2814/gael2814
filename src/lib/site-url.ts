/**
 * Public address of the website, used in emails and payment redirects.
 * APP_URL wins; on Vercel it falls back to the project's production address.
 */
export function siteUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
