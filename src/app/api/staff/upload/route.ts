import { assertSameOrigin, json, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX = 4 * 1024 * 1024;

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

/** Stores photos and the logo in the database so uploads work on any host (including Vercel). */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("menu.edit");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file uploaded" }, 400);
  if (file.size > MAX) return json({ error: "Photo is too large (max 4 MB). Try a smaller version." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !TYPES.has(type)) return json({ error: "Please upload a JPG, PNG or WebP image." }, 415);
  const img = await prisma.image.create({ data: { contentType: type, data: Buffer.from(bytes) } });
  return json({ id: img.id, url: `/api/images/${img.id}` }, 201);
});
