/**
 * 生产/测试环境测试残留数据排查与清理工具
 *
 * 用法:
 *   1. 仅排查检查 (默认只读，不改动任何数据):
 *      node scripts/clean-test-data.js
 *
 *   2. 执行清理 (带确认保护):
 *      node scripts/clean-test-data.js --execute
 *
 *   3. 跳过确认直接执行:
 *      node scripts/clean-test-data.js --execute --yes
 */

const { PrismaClient } = require("@prisma/client");
const readline = require("node:readline");

const prisma = new PrismaClient();
const isExecute = process.argv.includes("--execute");
const isAutoYes = process.argv.includes("--yes") || process.argv.includes("-y");

async function askConfirm(promptText) {
  if (isAutoYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(promptText, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  console.log("🔍 开始扫描数据库中的测试 / Demo 数据...\n");

  // 1. 扫描测试养殖户
  const testFarmers = await prisma.farmer.findMany({
    where: {
      OR: [
        { code: { contains: "TEST" } },
        { code: { contains: "DEMO" } },
        { code: { contains: "COLD_" } },
        { code: { contains: "PARITY_" } },
        { name: { contains: "测试" } },
        { name: { contains: "模范" } },
        { name: { contains: "张三-" } },
        { name: { contains: "李四-" } },
      ],
    },
    select: { id: true, code: true, name: true },
  });

  // 2. 扫描测试批次
  const testBatches = await prisma.batch.findMany({
    where: {
      OR: [
        { code: { contains: "TEST" } },
        { code: { contains: "DEMO" } },
      ],
    },
    select: { id: true, code: true, status: true },
  });

  // 3. 扫描测试出库单
  const testOutbounds = await prisma.outboundOrder.findMany({
    where: {
      OR: [
        { code: { contains: "TEST" } },
        { code: { contains: "DEMO" } },
      ],
    },
    select: { id: true, code: true, status: true },
  });

  // 4. 扫描临时测试用户 (包含大串数字时间戳的测试用户)
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: "test" } },
        { username: { contains: "1790" } },
        { username: { contains: "1789" } },
      ],
      NOT: [
        { username: "admin" },
        { username: "audit_mgr" },
        { username: "warehouse_mgr" },
        { username: "qa_lead" },
      ],
    },
    select: { id: true, username: true, fullName: true, role: true },
  });

  console.log("📊 扫描结果汇总：");
  console.log(`  - 含有测试特征的养殖户: ${testFarmers.length} 条`);
  console.log(`  - 含有测试特征的原料批次: ${testBatches.length} 条`);
  console.log(`  - 含有测试特征的出库单: ${testOutbounds.length} 条`);
  console.log(`  - 含有测试特征的临时用户: ${testUsers.length} 条`);

  if (testFarmers.length > 0) {
    console.log("\n[示例测试养殖户]:");
    testFarmers.slice(0, 5).forEach((f) => console.log(`   ${f.code} | ${f.name}`));
    if (testFarmers.length > 5) console.log(`   ...等共 ${testFarmers.length} 条`);
  }

  if (testUsers.length > 0) {
    console.log("\n[临时测试用户]:");
    testUsers.forEach((u) => console.log(`   [${u.role}] ${u.username} (${u.fullName})`));
  }

  const totalTestItems = testFarmers.length + testBatches.length + testOutbounds.length + testUsers.length;

  if (totalTestItems === 0) {
    console.log("\n✨ 数据库非常纯净，未发现任何明显的测试/Demo残留数据！");
    return;
  }

  if (!isExecute) {
    console.log("\n💡 当前为只读排查模式（未对数据库做任何修改）。");
    console.log("   如需清理上述测试数据，请运行:");
    console.log("   node scripts/clean-test-data.js --execute\n");
    return;
  }

  console.log("\n⚠️  准备执行清理测试数据！");
  const confirmed = await askConfirm("请输入 'yes' 确认清理上述测试数据: ");
  if (!confirmed) {
    console.log("🚫 操作已取消。");
    return;
  }

  console.log("\n🧹 正在清理关联的测试业务数据...");

  const farmerIds = testFarmers.map((f) => f.id);
  const batchIds = testBatches.map((b) => b.id);
  const outboundIds = testOutbounds.map((o) => o.id);
  const userIds = testUsers.map((u) => u.id);

  // 级联清理测试出库单及明细
  if (outboundIds.length > 0) {
    await prisma.outboundLine.deleteMany({ where: { orderId: { in: outboundIds } } });
    await prisma.outboundOrder.deleteMany({ where: { id: { in: outboundIds } } });
  }

  // 级联清理测试批次相关 (冷藏、分拣、捆扎、损耗、质检、领扣)
  if (batchIds.length > 0) {
    await prisma.qCRecord.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.inspectionReport.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.lossRecord.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.coldLog.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.sortTask.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.bundleBatch.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batchItem.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batch.deleteMany({ where: { id: { in: batchIds } } });
  }

  // 级联清理测试养殖户相关 (蟹扣领用、围网、养殖户)
  if (farmerIds.length > 0) {
    await prisma.tagClaim.deleteMany({ where: { farmerId: { in: farmerIds } } });
    await prisma.specialApproval.deleteMany({ where: { farmerId: { in: farmerIds } } });
    await prisma.enclosure.deleteMany({ where: { farmerId: { in: farmerIds } } });
    await prisma.farmer.deleteMany({ where: { id: { in: farmerIds } } });
  }

  // 清理临时测试用户
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log("✅ 测试残留数据清理完毕！系统台账已恢复整洁。");
}

main()
  .catch((e) => {
    console.error("❌ 执行失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
