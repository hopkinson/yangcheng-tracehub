import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createStoreOutboundAction } from "../src/actions/outbound";
import { approveOutboundOrderAction } from "../src/actions/approvals";

const prisma = new PrismaClient();

async function runColdOutboundFlowTest() {
  console.log("================================================================================");
  console.log("❄️  保鲜库批次出库与闭环验证测试 (Cold Storage Outbound Batch Flow Test)");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testSuffix = `COLD_${timestamp}`;

  try {
    // 1. 初始化基础主档
    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "admin",
        phone: "13800000001",
        fullName: "超级管理员",
        role: "ADMIN",
      },
    });

    const qaUser = await prisma.user.upsert({
      where: { username: "qa_lead" },
      update: {},
      create: {
        username: "qa_lead",
        phone: "13800000004",
        fullName: "品控主管",
        role: "QA_DIRECTOR",
      },
    });

    const channel = await prisma.channel.upsert({
      where: { code: "SAMS" },
      update: {},
      create: { code: "SAMS", name: "山姆会员商店" },
    });

    const store = await prisma.store.create({
      data: {
        code: `ST-${testSuffix}`,
        name: `山姆测试门店-${testSuffix}`,
        channelId: channel.id,
      },
    });

    // 2. 养殖户与暂养池
    const farmer = await prisma.farmer.create({
      data: {
        code: `JD-${testSuffix}`,
        name: "保鲜测试养殖户",
        phone: "13811112222",
        farmType: "LAKE_CRAB",
        year: 2026,
        area: 10,
        quota: 6000,
        enclosures: {
          create: [{ code: `W-${testSuffix}`, description: "东湖测试网" }],
        },
      },
      include: { enclosures: true },
    });

    const pool = await prisma.holdingPool.create({
      data: {
        code: `ZY-${testSuffix}`,
        name: "保鲜测试池",
        status: "ACTIVE",
        currentGender: "MALE",
        currentWeightTier: "4.0两",
      },
    });

    // 3. 原料入池 500只
    const rawBatch = await prisma.batch.create({
      data: {
        code: `PC-${testSuffix}`,
        farmerId: farmer.id,
        enclosureId: farmer.enclosures[0].id,
        poolId: pool.id,
        gender: "MALE",
        weightTier: "4.0两",
        inPoolCount: 500,
        outPoolCount: 500, // 模拟实物全部出池捆扎进入下游生产，此时暂养池在池存活已为 0！
        lossCount: 0,
        createdById: admin.id,
        status: "COMPLETED",
      },
    });

    // 4. 捆扎与分拣，产出合格品 500只
    const tagClaim = await prisma.tagClaim.create({
      data: {
        code: `XK-${testSuffix}`,
        claimDate: new Date(),
        farmerId: farmer.id,
        claimCount: 500,
        boundCount: 0,
        status: "APPROVED",
        applicantId: admin.id,
      },
    });

    const bundleGroup = await prisma.bundleGroup.create({
      data: { code: `P-${testSuffix}`, name: "保鲜测试组" },
    });

    const bundleBatch = await prisma.bundleBatch.create({
      data: {
        code: `KZD-${testSuffix}`,
        groupId: bundleGroup.id,
        tagClaimId: tagClaim.id,
        ropeBatch: `XS-${testSuffix}`,
        status: "COMPLETED",
      },
    });

    const sortMachine = await prisma.sortMachine.create({
      data: {
        code: `FJ-${testSuffix}`,
        name: "保鲜测试分拣机",
        status: "ACTIVE",
      },
    });

    const sortTask = await prisma.sortTask.create({
      data: {
        code: `FJR-${testSuffix}`,
        machineId: sortMachine.id,
        bundleBatchId: bundleBatch.id,
        gender: "MALE",
        weightTier: "4.0两",
        inputCount: 500,
        qualifiedCount: 500,
        status: "COMPLETED",
      },
    });

    // 5. 保鲜预冷入库 (生成保鲜入库批次 CR-TEST)
    const coldStore = await prisma.coldStore.create({
      data: {
        code: `BX-${testSuffix}`,
        name: "保鲜预冷测试库",
        targetTemp: 4.2,
      },
    });

    const coldLog = await prisma.coldLog.create({
      data: {
        code: `CR-${testSuffix}`,
        storeId: coldStore.id,
        type: "INTAKE",
        count: 500,
        refType: "SORT",
        refId: sortTask.code,
        operator: "测试仓管",
      },
    });

    console.log(`  ✔ 保鲜预冷批次生成成功: [${coldLog.code}] 存入 [${coldStore.name}] 500 只 (公蟹 4.0两)`);
    console.log(`  ℹ️  此时原料暂养池在池存活 = ${rawBatch.inPoolCount - rawBatch.outPoolCount - rawBatch.lossCount} 只 (已清空)`);

    // 6. 创建渠道待发货订单
    const order = await prisma.order.create({
      data: {
        code: `SO-${testSuffix}`,
        importId: `IM-${testSuffix}`,
        orderNo: `SM-${testSuffix}`,
        type: "STORE_ORDER",
        storeId: store.id,
        storeName: store.name,
        gender: "MALE",
        weightTier: "4.0两",
        count: 200,
        deliveryDate: new Date(),
        status: "PENDING",
      },
    });

    // 7. 基于保鲜预冷批次创建出库申请 (调用 createStoreOutboundAction)
    const outboundOrder = await createStoreOutboundAction({
      storeId: store.id,
      orderIds: [order.id],
      coldLogId: coldLog.id,
      transportCompany: "苏州冷链专车",
      licensePlate: "苏E·TEST",
      applicantId: admin.id,
    });

    assert.ok(outboundOrder.id, "出库单创建成功");
    assert.equal(outboundOrder.coldLogId, coldLog.id, "出库单已正确关联保鲜库预冷批次");
    assert.equal(outboundOrder.outboundCount, 200, "出库总数为 200 只");
    console.log(`  ✔ 基于保鲜批次 [${coldLog.code}] 创建出库申请成功: [${outboundOrder.code}]`);

    // 8. 品控审批出库申请 (调用 approveOutboundOrderAction)
    // 关键验证点：原料暂养池在池存活为 0，但冷库充足且关联了保鲜批次，审批必须成功放行！
    const approvedOrder = await approveOutboundOrderAction({
      orderId: outboundOrder.id,
      approved: true,
      comment: "冷库预冷合格品充足，准予出库",
      approverId: qaUser.id,
    });

    assert.equal(approvedOrder.status, "APPROVED", "出库单必须顺利审批通过");
    console.log(`  ✔ 出库单审批通过！不再受原料暂养池存活为0的错误拦截。`);

    console.log("\n================================================================================");
    console.log("🎉 保鲜库批次出库全链路业务闭环测试 100% 通过！");
    console.log("================================================================================");
  } finally {
    await prisma.$disconnect();
  }
}

runColdOutboundFlowTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
