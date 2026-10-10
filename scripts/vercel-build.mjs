// Build used by Vercel (runs automatically on every deploy, no terminal needed):
// 1. create/update the database tables  2. load the menu, photos and owner account (never overwrites edits)
// 3. build the website.
import { execSync } from "node:child_process";

const env = process.env;
env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || "";
env.DIRECT_DATABASE_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npx prisma generate");
if (env.DATABASE_URL) {
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
} else {
  console.warn("\n⚠️  No database connected yet. Connect one in Vercel → Storage, then redeploy.\n");
}
run("npx next build");
