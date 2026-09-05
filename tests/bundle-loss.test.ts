import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import {
  createBundleBatchAction,
  completeBundleBatchAction,
  createSortTasksAction,
} from "../src/actions/production";

async function testBundleLossWorkflow() {
  console.log("================================================================================");
  console.log("🦀 验证捆扎损耗计算、最终数量录入与下游分拣联动专项测试");
  console.log("================================================================================\n");

  const ts = Date.now();
  const suffix = `${ts}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. 准备测试养殖户、暂养池、批次和蟹扣
  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-BL-${suffix}`,
      name: `测试养殖户-${suffix}`,
      phone: `138${ts.toString().slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 50,
      quota: 30000,
    },
  });

  const enclosure = await prisma.enclosure.create({
    data: {
      code: `W-BL-${suffix}`,
      farmerId: farmer.id,
    },
  });

  const pool = await prisma.holdingPool.create({
    data: {
      code: `ZY-BL-${suffix}`,
      name: `捆扎损耗测试池-${suffix}`,
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  const user = await prisma.user.findFirst();

  const batch = await prisma.batch.create({
    data: {
      code: `PC-BL-${suffix}`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 3000,
      createdById: user!.id,
    },
  });

  const tagClaim = await prisma.tagClaim.create({
    data: {
      code: `XK-BL-${suffix}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 3000,
      status: "APPROVED",
      applicantId: user!.id,
    },
  });

  const group = await prisma.bundleGroup.create({
    data: {
      code: `P-BL-${suffix}`,
      name: `测试捆扎组-${suffix}`,
    },
  });

  const machine = await prisma.sortMachine.create({
    data: {
      code: `FJ-BL-${suffix}`,
      name: `测试分拣机-${suffix}`,
      status: "ACTIVE",
      lastCalibrationStatus: "QUALIFIED",
    },
  });

  try {
    // -------------------------------------------------------------------------
    // [测试阶段 1] 创建捆扎批次：投入 1000 只活蟹
    // -------------------------------------------------------------------------
    console.log("▶ [步骤 1] 创建捆扎批次（起池投入 1000 只）");
    const createRes = await createBundleBatchAction({
      groupId: group.id,
      tagClaimId: tagClaim.id,
      ropeBatch: `XS-${suffix}`,
      lines: [
        {
          poolId: pool.id,
          gender: "MALE",
          weightTier: "4.0两",
          count: 1000,
        },
      ],
    });

    assert.equal(createRes.success, true, "捆扎批次创建应成功");
    const createdBatch = await prisma.bundleBatch.findFirst({
      where: { groupId: group.id },
      include: { lines: true },
    });
    assert.ok(createdBatch, "数据库应存在该批次");
    assert.equal(createdBatch.inputCount, 1000, "起池投入只数应记录为 1000");
    assert.equal(createdBatch.status, "BUNDLING", "初始状态应为 BUNDLING");
    console.log("  ✔ 批次创建成功，初始投入 1000 只，状态 BUNDLING\n");

    const lineId = createdBatch.lines[0].id;

    // -------------------------------------------------------------------------
    // [测试阶段 2] 异常防守：合格数大于投入数（负损耗）拦截
    // -------------------------------------------------------------------------
    console.log("▶ [步骤 2] 拦截非法超量合格数（合格 1050 > 投入 1000）");
    const overQualifiedRes = await completeBundleBatchAction(createdBatch.id, [
      { lineId, qualifiedCount: 1050 },
    ]);
    assert.equal(overQualifiedRes.success, false, "合格只数超过投入只数必须拦截");
    console.log("  ✔ 超量合格数被成功拦截，错误提示符合预期\n");

    // -------------------------------------------------------------------------
    // [测试阶段 3] 风控防守：损耗率超过 5% 且未填原因拦截
    // -------------------------------------------------------------------------
    console.log("▶ [步骤 3] 拦截超 5% 损耗且未填写原因的操作（合格 900，损耗 100，损耗率 10%）");
    const unreasonedRes = await completeBundleBatchAction(createdBatch.id, [
      { lineId, qualifiedCount: 900 },
    ]);
    assert.equal(unreasonedRes.success, false, "超 5% 损耗未填原因必须拦截");
    assert.ok(unreasonedRes.message.includes("5%"), "应提示 5% 警戒阈值");
    console.log("  ✔ 超 5% 阈值强制留痕拦截校验通过\n");

    // -------------------------------------------------------------------------
    // [测试阶段 4] 正常完成捆扎：录入合格 980 只（损耗 20 只，损耗率 2.0%）
    // -------------------------------------------------------------------------
    console.log("▶ [步骤 4] 正常录入最终合格 980 只并完成捆扎结算");
    const completeRes = await completeBundleBatchAction(createdBatch.id, [
      { lineId, qualifiedCount: 980 },
    ]);
    assert.equal(completeRes.success, true, "正常录入应成功完成");

    const updatedBatch = await prisma.bundleBatch.findUnique({
      where: { id: createdBatch.id },
      include: { lines: true },
    });
    assert.equal(updatedBatch!.status, "COMPLETED", "批次状态应流转为 COMPLETED");
    assert.equal(updatedBatch!.inputCount, 1000, "投入总数应为 1000");
    assert.equal(updatedBatch!.qualifiedCount, 980, "最终合格数应为 980");
    assert.equal(updatedBatch!.lossCount, 20, "损耗只数应结算为 20");
    assert.equal(updatedBatch!.lossRate, 2.0, "损耗率应为 2.0%");
    assert.equal(updatedBatch!.lines[0].qualifiedCount, 980, "明细行合格数应更新为 980");
    assert.equal(updatedBatch!.lines[0].lossCount, 20, "明细行损耗数应更新为 20");
    console.log("  ✔ 批次与明细行数据准确落地（合格 980 只，损耗 20 只，损耗率 2.0%）\n");

    // -------------------------------------------------------------------------
    // [测试阶段 5] 下游分拣称重联动校验
    // -------------------------------------------------------------------------
    console.log("▶ [步骤 5] 下游分拣任务投料上限卡控（应以捆扎合格数 980 为准，而非投入数 1000）");
    // 5.1 尝试按原投入数 990 创建分拣（超过捆扎合格数 980）-> 必须拦截
    const overSortRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: updatedBatch!.id,
      items: [
        {
          lineId,
          gender: "MALE",
          weightTier: "4.0两",
          inputCount: 990,
        },
      ],
    });
    assert.equal(overSortRes.success, false, "超出捆扎合格数量的分拣投料必须被拦截");
    assert.ok(overSortRes.message.includes("980"), "错误信息应明确提示上限为 980 只");
    console.log("  ✔ 成功拦截超量分拣（990 只 > 捆扎合格 980 只）");

    // 5.2 按照捆扎合格数 980 创建分拣 -> 成功
    const validSortRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: updatedBatch!.id,
      items: [
        {
          lineId,
          gender: "MALE",
          weightTier: "4.0两",
          inputCount: 980,
        },
      ],
    });
    assert.equal(validSortRes.success, true, "合规分拣任务应创建成功");
    console.log("  ✔ 成功创建分拣任务（按真实合格 980 只流转进入分拣环节）\n");

    console.log("🎉 捆扎记录损耗、录入最终数量及全链路联动校验 100% 达到要求！");
  } finally {
    // 清理测试临时数据
    await prisma.sortTask.deleteMany({ where: { bundleBatch: { groupId: group.id } } }).catch(() => {});
    await prisma.bundleLine.deleteMany({ where: { bundleBatch: { groupId: group.id } } }).catch(() => {});
    await prisma.bundleBatch.deleteMany({ where: { groupId: group.id } }).catch(() => {});
    await prisma.bundleGroup.delete({ where: { id: group.id } }).catch(() => {});
    await prisma.sortMachine.delete({ where: { id: machine.id } }).catch(() => {});
    await prisma.tagClaim.delete({ where: { id: tagClaim.id } }).catch(() => {});
    await prisma.batch.delete({ where: { id: batch.id } }).catch(() => {});
    await prisma.holdingPool.delete({ where: { id: pool.id } }).catch(() => {});
    await prisma.enclosure.delete({ where: { id: enclosure.id } }).catch(() => {});
    await prisma.farmer.delete({ where: { id: farmer.id } }).catch(() => {});
  }
}

testBundleLossWorkflow().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
