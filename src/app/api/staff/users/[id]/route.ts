import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { hashPassword, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const me = await requirePermission("users.manage");
  const { id } = await ctx.params;
  const d = z
    .object({
      name: z.string().trim().min(1).max(80),
      role: z.enum(["OWNER", "MANAGER", "KITCHEN"]),
      active: z.boolean(),
      password: z.string().min(10, "Password must be at least 10 characters").max(200),
    })
    .partial()
    .strict()
    .parse(await req.json());
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  const losingOwner = target.role === "OWNER" && ((d.role && d.role !== "OWNER") || d.active === false);
  if (losingOwner) {
    const owners = await prisma.user.count({ where: { role: "OWNER", active: true } });
    if (owners <= 1) return json({ error: "There must always be at least one active owner." }, 409);
  }
  if (id === me.id && d.active === false) return json({ error: "You can't deactivate your own account." }, 409);
  const { password, ...rest } = d;
  const user = await prisma.user.update({
    where: { id },
    data: { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  return json(user);
});
