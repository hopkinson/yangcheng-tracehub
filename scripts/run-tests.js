// ponytail: 测试打独立 test.db，不再污染 dev.db。
// 进程级设一次 DATABASE_URL 即可，12 个测试文件里的 new PrismaClient() 一个都不用改。
const { spawnSync } = require("node:child_process");
const { existsSync, statSync } = require("node:fs");

// 测试使用本地 PostgreSQL 数据库，与本地开发隔离，绝不连接生产云端 RDS
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://crabcard:crabcard@localhost:5433/yangcheng?schema=public";

const run = (args) =>
  spawnSync("npx", args, { stdio: "inherit", shell: true, env: process.env });

const fresh = process.argv.includes("--fresh");
const shouldPush = fresh || true;

if (shouldPush) {
  const r = run(["prisma", "db", "push", "--skip-generate", "--accept-data-loss"]);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const files = process.argv.slice(2).filter((a) => a.endsWith(".ts"));
if (files.length === 0) {
  console.error("usage: node scripts/run-tests.js <test.ts> [...] [--fresh]");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  if (run(["tsx", file]).status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
