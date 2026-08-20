import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { createBatchAction, registerLossAction } from "../src/actions/batches";
import { requestTagClaimAction, settleDailyTagClaimAction } from "../src/actions/tags";
import { createOutboundOrderAction } from "../src/actions/outbound";
import { approveTagClaimAction, approveOutboundOrderAction } from "../src/actions/approvals";

async function runActionsTest() {
  console.log("🧪 运行 Server Actions 完整业务闭环与强事务测试...");

  const user = await prisma.user.findFirstOrThrow({ where: { role: "WAREHOUSE_ADMIN" } });
  const qa = await prisma.user.findFirstOrThrow({ where: { role: "QA_DIRECTOR" } });
  const farmer = await prisma.farmer.findFirstOrThrow({ where: { code: "JD-2026-001" }, include: { enclosures: true } });
  const pool = await prisma.holdingPool.findFirstOrThrow({ where: { code: "ZY-03" } }); // 空池
  const store = await prisma.store.findFirstOrThrow({ where: { code: "ST-01" } });

  // 1. 测试入池登记 (空池入池并自动锁定规格)
  console.log("  -> 测试批次入池登记...");
  const newBatch = await createBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    poolId: pool.id,
    gender: "FEMALE",
    weightTier: "3.5两",
    inPoolCount: 1000,
    createdById: user.id,
  });
  assert.strictEqual(newBatch.inPoolCount, 1000);

  // 验证池子规格已被锁定
  const updatedPool = await prisma.holdingPool.findUniqueOrThrow({ where: { id: pool.id } });
  assert.strictEqual(updatedPool.currentGender, "FEMALE");
  assert.strictEqual(updatedPool.currentWeightTier, "3.5两");

  // 2. 测试混池冲突拦截
  console.log("  -> 测试混池冲突拦截...");
  await assert.rejects(
    async () => {
      await createBatchAction({
        farmerId: farmer.id,
        enclosureId: farmer.enclosures[0].id,
        poolId: pool.id,
        gender: "MALE", // 冲突
        weightTier: "4.0两",
        inPoolCount: 500,
        createdById: user.id,
      });
    },
    { message: /规格冲突/ }
  );

  // 3. 测试盘点损耗 (登记 20 只损耗)
  console.log("  -> 测试盘点损耗登记...");
  const lossRes = await registerLossAction({
    batchId: newBatch.id,
    physicalCount: 980,
    reason: "运输轻微脱水",
    inspectorId: user.id,
  });
  assert.strictEqual(lossRes.record.lossCount, 20);
  assert.strictEqual(lossRes.updatedBatch.lossCount, 20);

  // 4. 测试蟹扣领用申请与品控审批
  console.log("  -> 测试蟹扣领用申请与审批...");
  const claim = await requestTagClaimAction({
    farmerId: farmer.id,
    claimCount: 500,
    applicantId: user.id,
  });
  assert.strictEqual(claim.status, "PENDING");

  const approvedClaim = await approveTagClaimAction({
    claimId: claim.id,
    approverId: qa.id,
    approved: true,
    comment: "额度核实一致，准予领用",
  });
  assert.strictEqual(approvedClaim.status, "APPROVED");

  // 5. 测试出库申请与品控审批 (出库 500 只)
  console.log("  -> 测试出库申请与审批扣减库存...");
  const order = await createOutboundOrderAction({
    batchId: newBatch.id,
    storeId: store.id,
    outboundCount: 500,
    channelOrderCount: 500,
    applicantId: user.id,
  });
  assert.strictEqual(order.status, "PENDING");

  const approvedOrder = await approveOutboundOrderAction({
    orderId: order.id,
    approverId: qa.id,
    approved: true,
    comment: "单票核对一致，批准出库",
  });
  assert.strictEqual(approvedOrder.status, "APPROVED");

  // 验证批次库存已扣减 (1000 - 20损耗 - 500出库 = 480在池)
  const batchAfterOutbound = await prisma.batch.findUniqueOrThrow({ where: { id: newBatch.id } });
  assert.strictEqual(batchAfterOutbound.outPoolCount, 500);

  // 6. 测试蟹扣日清日结轧平
  console.log("  -> 测试蟹扣日结轧平...");
  const settled = await settleDailyTagClaimAction({
    tagClaimId: claim.id,
    boundCount: 480,
    returnedCount: 15,
    returnReason: "规格微瑕退回",
    scrappedCount: 5,
    scrapReason: "扣带磨损作废",
    operatorId: user.id,
  });
  assert.strictEqual(settled.isBalanced, true); // 500 == 480 + 15 + 5

  console.log("✅ 全部 Server Actions 业务流与强事务测试通过！");
}

runActionsTest()
  .catch((err) => {
    console.error("❌ 测试失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
