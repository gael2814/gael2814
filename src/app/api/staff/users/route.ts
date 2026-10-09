import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { hashPassword, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const select = { id: true, email: true, name: true, role: true, active: true, createdAt: true } as const;

export const GET = route(async () => {
  await requirePermission("users.manage");
  return json(await prisma.user.findMany({ select, orderBy: [{ role: "asc" }, { name: "asc" }] }));
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requirePermission("users.manage");
  const d = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(["OWNER", "MANAGER", "KITCHEN"]),
      password: z.string().min(10, "Password must be at least 10 characters").max(200),
    })
    .parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: d.email } })) return json({ error: "That email already has an account." }, 409);
  const user = await prisma.user.create({
    data: { name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password) },
    select,
  });
  return json(user, 201);
});
