import { z } from "zod";
import { assertSameOrigin, json, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loginThrottle, startSession, verifyPassword } from "@/lib/auth";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const { email, password } = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).parse(await req.json());
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const throttle = loginThrottle(`${ip}:${email}`);
  if (throttle.blocked) return json({ error: "Too many attempts. Please wait 15 minutes." }, 429);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    throttle.fail();
    return json({ error: "Email or password is incorrect." }, 401);
  }
  throttle.reset();
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  return json({ ok: true, role: user.role });
});
