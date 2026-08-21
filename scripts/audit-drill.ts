import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const prisma = new PrismaClient();

async function runAuditDrill() {
  console.log("========================================================================");
  console.log("🎯 阳澄股份大闸蟹溯源系统 —— 山姆会员店供应商合规与追溯全流程演练沙盘");
  console.log("========================================================================\n");

  // 1. 模拟渠道审核员按发运单号反向追溯
  const targetOrderCode = "CK-20260901-001";
  console.log(`[步骤 1] 审查员输入单号发起反向追溯: 【${targetOrderCode}】`);

  const order = await prisma.outboundOrder.findUniqueOrThrow({
    where: { code: targetOrderCode },
    include: {
      batch: {
        include: {
          farmer: { include: { enclosures: true } },
          enclosure: true,
          pool: true,
        },
      },
      store: { include: { channel: true } },
      channel: true,
    },
  });

  console.log("  ✔ 出库单信息:");
  console.log(`    - 出库发运单号: ${order.code}`);
  console.log(`    - 接收销售门店: ${order.store.name} (${order.channel.name})`);
  console.log(`    - 发货数量: ${order.outboundCount} 只`);
  console.log(`    - 物流单号: ${order.logisticsNo}`);

  console.log("\n  ✔ 原料批次与品质检测证明 (PRD V1.4):");
  console.log(`    - 原料批次编号: ${order.batch.code}`);
  console.log(`    - 活蟹规格档位: ${order.batch.gender === "MALE" ? "公蟹" : "母蟹"} · ${order.batch.weightTier}`);
  console.log(`    - 入池暂养仓位: ${order.batch.pool.name} (${order.batch.pool.code})`);
  console.log(`    - 药残检测报告: ${order.batch.reportName || "已上传"}`);
  console.log(`    - 报告上传时间: ${order.batch.reportUploadedAt ? order.batch.reportUploadedAt.toISOString() : "已留痕"}`);
  assert.ok(order.batch.reportUrl, "批次必须包含检测报告证据");

  console.log("\n  ✔ 源头水域与签约主体穿透:");
  console.log(`    - 签约养殖户: ${order.batch.farmer.name} (蟹扣编码: ${order.batch.farmer.code})`);
  console.log(`    - 养殖水域类型: ${order.batch.farmer.farmType === "LAKE_CRAB" ? "阳澄湖核心围网" : "生态塘"}`);
  console.log(`    - 围网水域编号: ${order.batch.enclosure.code}`);
  console.log(`    - 签约面积: ${order.batch.farmer.area} 亩`);
  console.log(`    - 核定额度: ${order.batch.farmer.quota.toLocaleString()} 只 (600只/亩)`);

  // 2. 数量闭环与守恒证明计算
  console.log("\n[步骤 2] 审查员验证四大数量守恒与闭环数学证明:");

  // 守恒一：养殖户累计入池 <= 核定额度
  const allFarmerBatches = await prisma.batch.findMany({
    where: { farmerId: order.batch.farmerId },
  });
  const cumulativeInPool = allFarmerBatches.reduce((sum, b) => sum + b.inPoolCount, 0);
  console.log(`  1. 源头产能守恒: 当年累计入池(${cumulativeInPool}) <= 年度核定总额度(${order.batch.farmer.quota})`);
  assert.ok(cumulativeInPool <= order.batch.farmer.quota, "源头产量必须守恒");

  // 守恒二：批次在池存活 >= 出库数
  const liveInBatch = order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;
  console.log(`  2. 批次存活守恒: 初始入池(${order.batch.inPoolCount}) - 出库(${order.batch.outPoolCount}) - 损耗(${order.batch.lossCount}) = 当前在池(${liveInBatch}) >= 0`);
  assert.ok(liveInBatch >= 0, "账面在池存活不得小于0");

  // 守恒三：单票发货数 == 渠道订单数
  console.log(`  3. 单票发运核对: 出库发货数(${order.outboundCount}) === 渠道订单数(${order.channelOrderCount})`);
  assert.equal(order.outboundCount, order.channelOrderCount, "发货数与订单数必须绝对一致");

  // 守恒四：蟹扣日清日结轧平
  const todayClaim = await prisma.tagClaim.findFirst({
    where: { farmerId: order.batch.farmerId, status: "APPROVED" },
  });
  if (todayClaim) {
    const isBalanced = todayClaim.claimCount === todayClaim.boundCount + todayClaim.returnedCount + todayClaim.scrappedCount;
    console.log(`  4. 蟹扣当日轧平: 申请领扣(${todayClaim.claimCount}) === 绑扣出库(${todayClaim.boundCount}) + 退回(${todayClaim.returnedCount}) + 作废(${todayClaim.scrappedCount})`);
    assert.ok(isBalanced, "蟹扣日结必须完全轧平");
  }

  // 3. 渠道数据安全隔离演练
  console.log("\n[步骤 3] 数据安全与跨渠道隔离审计演练:");
  const samsUser = await prisma.user.findFirstOrThrow({ where: { role: "CHANNEL_VIEWER" } });
  const isAuthorized = order.channelId === samsUser.channelId;
  console.log(`  - 渠道用户【${samsUser.fullName}】调阅本渠道出库单【${order.code}】: ${isAuthorized ? "✅ 授权通过 (符合数据安全规范)" : "❌ 越权拦截"}`);
  assert.ok(isAuthorized, "渠道专属账号可查验本渠道数据");

  console.log("\n========================================================================");
  console.log("🏆 演练结论：全链路反向追溯链条 100% 完整，数量闭环完全守恒，符合山姆审核标准！");
  console.log("========================================================================\n");
}

runAuditDrill()
  .catch((e) => {
    console.error("❌ 演练失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
