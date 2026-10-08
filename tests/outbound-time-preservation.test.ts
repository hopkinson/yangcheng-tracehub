import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import { formatDateTime, parseBeijingDateTime } from "../src/lib/utils";

async function main() {
  // 执行生产启动脚本内嵌 JS 与 SQL，使用内存库验证重启不会覆盖预约时间。
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE "User" ("id" TEXT);
    CREATE TABLE "OutboundLossOrder" ("applicantId" TEXT);
    CREATE TABLE "OutboundOrder" ("status" TEXT, "outboundTime" TEXT, "approvedAt" TEXT);
    INSERT INTO "OutboundLossOrder" VALUES ('deleted-user');
    INSERT INTO "OutboundOrder" VALUES
      ('APPROVED', '2026-10-08T02:00:00+08:00', '2026-10-07T15:29:41+08:00'),
      ('PENDING', '2026-10-08T03:00:00+08:00', NULL);
  `);
  const entrypoint = readFileSync(new URL("../docker-entrypoint.sh", import.meta.url), "utf8");
  const blocks = [...entrypoint.matchAll(/node -e '([\s\S]*?)' >\/dev\/null/g)];
  assert.ok(blocks.length > 0, "应执行生产启动数据修复代码");
  class TestPrismaClient {
    async $executeRawUnsafe(sql: string) { db.exec(sql); }
    async $disconnect() {}
  }
  try {
    for (let restart = 0; restart < 2; restart++) {
      for (const [, block] of blocks) {
        await runInNewContext(block.replaceAll("'\\''", "'"), {
          require: () => ({ PrismaClient: TestPrismaClient }),
        });
      }
      const rows = db.prepare('SELECT "outboundTime" FROM "OutboundOrder"').all();
      assert.equal(rows[0].outboundTime, "2026-10-08T02:00:00+08:00", "服务重启必须保留已审核单的凌晨预约时间");
      assert.equal(rows[1].outboundTime, "2026-10-08T03:00:00+08:00", "待审核单预约时间应保持不变");
    }
    assert.equal(db.prepare('SELECT "applicantId" FROM "OutboundLossOrder"').get()?.applicantId, null, "保留孤儿损耗单修复");
  } finally {
    db.close();
  }

  // 验证实际台账两处取值表达式，避免测试复制一份与页面脱节的时间规则。
  const ledger = readFileSync(new URL("../src/app/ledgers/page.tsx", import.meta.url), "utf8");
  const expressions = [...ledger.matchAll(/const actualOutTime = ([^;]+);/g)];
  assert.equal(expressions.length, 2, "单据及明细台账都应验证");
  for (const [, expression] of expressions) {
    const order = {
      outboundTime: parseBeijingDateTime("2026-10-08T02:00"),
      approvedAt: new Date("2026-10-07T15:29:41+08:00"),
      createdAt: new Date("2026-10-07T15:28:00+08:00"),
    };
    assert.equal(formatDateTime(runInNewContext(expression, { order })), "2026-10-08 02:00", "台账必须显示凌晨出库时间，不能显示下午审核时间");
    assert.equal(formatDateTime(runInNewContext(expression, { order: { ...order, outboundTime: null } })), "2026-10-07 15:29", "缺失业务时间时兼容历史审核时间");
  }
  const dashboard = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const filter = dashboard.match(/const todayOutboundOrders = ([^;]+);/);
  assert.ok(filter, "应验证首页实际出库统计表达式");
  const outboundOrders = ["APPROVED", "PENDING", "REJECTED"].map((status) => ({
    status,
    outboundTime: parseBeijingDateTime("2026-10-08T02:00"),
    approvedAt: parseBeijingDateTime("2026-10-07T15:29"),
    createdAt: parseBeijingDateTime("2026-10-07T15:28"),
  }));
  const isToday = (date: Date) => formatDateTime(date).startsWith("2026-10-08");
  const todayOrders = runInNewContext(filter[1], { outboundOrders, isToday });
  assert.equal(todayOrders.length, 1, "跨日预约应按业务出库日计入首页，排除待审核与驳回单");
  assert.equal(todayOrders[0].status, "APPROVED");
  console.log("✔ 连续重启保留凌晨预约时间，台账与首页统计按业务出库时间取值");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
