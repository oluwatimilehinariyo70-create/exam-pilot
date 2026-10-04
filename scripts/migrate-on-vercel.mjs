import { spawnSync } from "node:child_process";

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for Vercel migration deployment.");
  process.exit(1);
}

const prismaCommand = process.platform === "win32" ? "prisma.cmd" : "prisma";
const prismaArgs = ["--schema=prisma/schema.prisma"];

function runPrisma(args, options = {}) {
  return spawnSync(prismaCommand, [...args, ...prismaArgs], {
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

const status = runPrisma(["migrate", "status"], { capture: true });
const statusOutput = `${status.stdout ?? ""}\n${status.stderr ?? ""}`;
process.stdout.write(status.stdout ?? "");
process.stderr.write(status.stderr ?? "");

if (/P3005|database schema is not empty/i.test(statusOutput)) {
  const baseline = "20260823000000_baseline_existing_schema";
  const resolved = runPrisma(["migrate", "resolve", "--applied", baseline], { capture: true });
  const resolvedOutput = `${resolved.stdout ?? ""}\n${resolved.stderr ?? ""}`;
  process.stdout.write(resolved.stdout ?? "");
  process.stderr.write(resolved.stderr ?? "");
  if (resolved.status !== 0 && !/P3008|already recorded|already applied/i.test(resolvedOutput)) {
    process.exit(resolved.status ?? 1);
  }
}

const result = runPrisma(["migrate", "deploy"]);

if (result.error) {
  console.error(`Unable to run Prisma migrations: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
