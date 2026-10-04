import { spawnSync } from "node:child_process";

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for Vercel migration deployment.");
  process.exit(1);
}

const prismaCommand = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(prismaCommand, ["migrate", "deploy", "--schema=prisma/schema.prisma"], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to run Prisma migrations: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
