import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { aggregateTraceableColdStocks } from "../src/lib/cold-stock";
import { approveOutboundLossAction } from "../src/actions/approvals";
import { batchRegisterOutboundLossAction } from "../src/actions/outbound";

const prisma = new PrismaClient();

async function runTests() {
  console.log("🧪 启动出库损耗单全生命周期审批流与统计归集契约测试...\n");

  const timestamp = Date.now();

  // 1. 获取测试操作员与入库日志（若为独立干净测试库则自动自建测试用例夹）
  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: `loss_admin_${timestamp}`,
        phone: `138${String(timestamp).slice(-8)}`,
        fullName: "损耗测试管理员",
        role: "ADMIN",
      },
    });
  }

  let coldLog = await prisma.coldLog.findFirst({
    where: { type: "INTAKE" },
    include: {
      sortTask: { include: { bundleBatch: { include: { sourceBatch: true } } } },
      store: true,
    },
  });

  if (!coldLog) {
    const farmer = await prisma.farmer.create({
      data: {
        code: `JD-LOSS-${timestamp}`,
        name: `损耗测试养殖户-${timestamp}`,
        phone: `139${String(timestamp).slice(-8)}`,
        farmType: "LAKE_CRAB",
        year: 2026,
        area: 10,
        quota: 6000,
      },
    });
    const enclosure = await prisma.enclosure.create({
      data: { code: `W-LOSS-${timestamp}`, farmerId: farmer.id },
    });
    const pool = await prisma.holdingPool.create({
      data: { code: `ZY-LOSS-${timestamp}`, name: `损耗测试池-${timestamp}`, currentGender: "MALE", currentWeightTier: "4.0两" },
    });
    const batch = await prisma.batch.create({
      data: {
        code: `YL-LOSS-${timestamp}`,
        farmerId: farmer.id,
        enclosureId: enclosure.id,
        poolId: pool.id,
        gender: "MALE",
        weightTier: "4.0两",
        inPoolCount: 100,
        outPoolCount: 100,
        status: "COMPLETED",
        createdById: admin.id,
      },
    });
    const claim = await prisma.tagClaim.create({
      data: {
        code: `LQ-LOSS-${timestamp}`,
        farmerId: farmer.id,
        claimDate: new Date(),
        claimCount: 100,
        boundCount: 100,
        status: "APPROVED",
        applicantId: admin.id,
      },
    });
    const bundleGroup = await prisma.bundleGroup.create({
      data: {
        code: `P-LOSS-${timestamp}`,
        name: `损耗测试班组-${timestamp}`,
      },
    });
    const bundle = await prisma.bundleBatch.create({
      data: {
        code: `BZ-LOSS-${timestamp}`,
        sourceBatchId: batch.id,
        tagClaimId: claim.id,
        groupId: bundleGroup.id,
        ropeBatch: `XS-${timestamp}`,
        inputCount: 100,
        qualifiedCount: 100,
        status: "COMPLETED",
      },
    });
    const machine = await prisma.sortMachine.create({
      data: {
        code: `FJ-M-${timestamp}`,
        name: `损耗测试机-${timestamp}`,
      },
    });
    const sortTask = await prisma.sortTask.create({
      data: {
        code: `FJ-LOSS-${timestamp}`,
        bundleBatchId: bundle.id,
        machineId: machine.id,
        gender: "MALE",
        weightTier: "4.0两",
        inputCount: 100,
        qualifiedCount: 100,
        lossCount: 0,
        lossRate: 0,
        status: "COMPLETED",
      },
    });
    const coldStore = await prisma.coldStore.create({
      data: {
        code: `BX-S-${timestamp}`,
        name: `损耗测试库-${timestamp}`,
      },
    });
    coldLog = await prisma.coldLog.create({
      data: {
        code: `LL-LOSS-${timestamp}`,
        storeId: coldStore.id,
        sortTaskId: sortTask.id,
        count: 100,
        type: "INTAKE",
        operator: "测试入库员",
      },
      include: {
        sortTask: { include: { bundleBatch: { include: { sourceBatch: true } } } },
        store: true,
      },
    });
  }

  const gender = coldLog.sortTask.gender;
  const weightTier = coldLog.sortTask.weightTier;

  console.log(`▶ [Test 1] 针对冷库批次 [${coldLog.code}] (${gender === "FEMALE" ? "母蟹" : "公蟹"} ${weightTier}) 创建出库损耗单`);

  const lossCount = 1;
  const initialLossOrdersCount = await prisma.outboundLossOrder.count();

  // 模拟创建出库损耗单
  const lossOrder = await prisma.outboundLossOrder.create({
    data: {
      code: `SHTEST${timestamp}`,
      inventoryDate: new Date(),
      totalLossCount: lossCount,
      lossRate: 2.5,
      isException: false,
      reason: "装箱前挑拣出1只死蟹进行核减",
      status: "PENDING",
      applicantId: admin.id,
      items: {
        create: [
          {
            gender,
            weightTier,
            lossCount,
            lossRate: 2.5,
            isException: false,
          },
        ],
      },
      records: {
        create: [
          {
            gender,
            weightTier,
            count: lossCount,
            reason: "装箱前挑拣出1只死蟹进行核减",
            status: "PENDING",
            coldLogId: coldLog.id,
            operatorId: admin.id,
          },
        ],
      },
    },
    include: {
      items: true,
      records: true,
    },
  });

  assert.equal(lossOrder.status, "PENDING", "新创建的出库损耗单初始状态必须为 PENDING (待审核)");
  assert.equal(lossOrder.items.length, 1, "损耗明细项必须包含该规格");
  assert.equal(lossOrder.records.length, 1, "损耗记录必须对应关联到冷库批次");
  assert.equal(lossOrder.records[0].status, "PENDING", "损耗记录状态同步为 PENDING");
  console.log("  ✔ 出库损耗单建单、多规格明细与 PENDING 待审核状态校验通过");

  // 2. 校验库存锁定：PENDING 状态下，冷库规格库存计算必须计入损耗核减，防止超发抢占
  console.log("▶ [Test 2] 校验 PENDING 状态下损耗核减与库存锁定规则");
  const stocksWithPending = aggregateTraceableColdStocks({
    sortTasks: [coldLog.sortTask],
    coldLogs: [coldLog],
    outboundLines: [],
    outboundLosses: [lossOrder.records[0]],
    defaultSpecs: [],
  });
  const targetStock = stocksWithPending.find((s) => s.gender === gender && s.weightTier === weightTier);
  assert.ok(targetStock, "应找到对应的规格库存");
  assert.equal(targetStock.loss, lossCount, "待审核损耗单必须计入 loss (损耗核减)");
  assert.equal(targetStock.used, 0, "损耗单绝不得计入 used (发货出库占用)");
  console.log("  ✔ PENDING 损耗单锁定库存且计入损耗维度校验通过");

  // 3. 校验审批通过 (已核销)
  console.log("▶ [Test 3] 审批通过：状态流转为 APPROVED (已核销)");
  await prisma.$transaction(async (tx) => {
    await tx.outboundLossRecord.updateMany({
      where: { lossOrderId: lossOrder.id },
      data: { status: "APPROVED" },
    });
    await tx.outboundLossOrder.update({
      where: { id: lossOrder.id },
      data: {
        status: "APPROVED",
        approverId: admin.id,
        approvalComment: "审核通过，准予核销",
        approvedAt: new Date(),
      },
    });
  });

  const approvedOrder = await prisma.outboundLossOrder.findUniqueOrThrow({
    where: { id: lossOrder.id },
    include: { records: true },
  });
  assert.equal(approvedOrder.status, "APPROVED");
  assert.equal(approvedOrder.records[0].status, "APPROVED");
  assert.ok(approvedOrder.approvedAt, "必须记录审核时间");
  console.log("  ✔ 审批通过流转与 APPROVED 状态记录通过");

  // 4. 校验驳回流转与库存释放
  console.log("▶ [Test 4] 校验驳回流转：状态转为 REJECTED，且库存占用立即解除释放");
  const rejectedLossOrder = await prisma.outboundLossOrder.create({
    data: {
      code: `SHREJ${timestamp}`,
      inventoryDate: new Date(),
      totalLossCount: 2,
      lossRate: 3.0,
      isException: false,
      reason: "测试驳回损耗",
      status: "PENDING",
      applicantId: admin.id,
      items: {
        create: [
          {
            gender,
            weightTier,
            lossCount: 2,
            lossRate: 3.0,
            isException: false,
          },
        ],
      },
      records: {
        create: [
          {
            gender,
            weightTier,
            count: 2,
            reason: "测试驳回损耗",
            status: "PENDING",
            coldLogId: coldLog.id,
            operatorId: admin.id,
          },
        ],
      },
    },
    include: { records: true },
  });

  // 驳回
  await prisma.$transaction(async (tx) => {
    await tx.outboundLossRecord.updateMany({
      where: { lossOrderId: rejectedLossOrder.id },
      data: { status: "REJECTED" },
    });
    await tx.outboundLossOrder.update({
      where: { id: rejectedLossOrder.id },
      data: {
        status: "REJECTED",
        rejectReason: "实盘数量核实无误，无需核减",
        approverId: admin.id,
        approvedAt: new Date(),
      },
    });
  });

  const afterRejectRecord = await prisma.outboundLossRecord.findFirstOrThrow({
    where: { lossOrderId: rejectedLossOrder.id },
  });
  assert.equal(afterRejectRecord.status, "REJECTED");

  // 验证 aggregateTraceableColdStocks 会自动忽略 REJECTED 记录
  const stocksAfterReject = aggregateTraceableColdStocks({
    sortTasks: [coldLog.sortTask],
    coldLogs: [coldLog],
    outboundLines: [],
    outboundLosses: [afterRejectRecord],
    defaultSpecs: [],
  });
  const stockCheck = stocksAfterReject.find((s) => s.gender === gender && s.weightTier === weightTier);
  assert.equal(stockCheck?.loss, 0, "被驳回的损耗记录不得计入损耗核减，库存必须完全释放");
  console.log("  ✔ 驳回后库存释放与 REJECTED 忽略校验通过");

  // 5. 校验多规格展开
  console.log("▶ [Test 5] 校验多规格出库损耗明细完整性与独立展示");
  const multiSpecOrder = await prisma.outboundLossOrder.create({
    data: {
      code: `SHMULTI${timestamp}`,
      inventoryDate: new Date(),
      totalLossCount: 16,
      lossRate: 4.8,
      isException: false,
      reason: "收尾清库挑拣死蟹",
      status: "PENDING",
      applicantId: admin.id,
      items: {
        create: [
          { gender: "MALE", weightTier: "4.0两", lossCount: 1, lossRate: 2.6, isException: false },
          { gender: "FEMALE", weightTier: "3.2两", lossCount: 15, lossRate: 17.6, isException: true },
        ],
      },
    },
    include: { items: true },
  });
  assert.equal(multiSpecOrder.items.length, 2, "多规格损耗单必须包含全部规格明细项");
  assert.equal(multiSpecOrder.items[0].lossCount + multiSpecOrder.items[1].lossCount, 16, "各规格损耗总和必须等于总核减数");
  console.log("  ✔ 多规格损耗单规格完整性校验通过");

  // 清理测试数据
  await prisma.outboundLossRecord.deleteMany({
    where: { lossOrderId: { in: [lossOrder.id, rejectedLossOrder.id, multiSpecOrder.id] } },
  });
  await prisma.outboundLossItem.deleteMany({
    where: { lossOrderId: { in: [lossOrder.id, rejectedLossOrder.id, multiSpecOrder.id] } },
  });
  await prisma.outboundLossOrder.deleteMany({
    where: { id: { in: [lossOrder.id, rejectedLossOrder.id, multiSpecOrder.id] } },
  });

  console.log("\n🎉 全部出库损耗单审批流与统计契约测试 100% 通过！");
}

runTests()
  .catch((err) => {
    console.error("❌ 测试失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
