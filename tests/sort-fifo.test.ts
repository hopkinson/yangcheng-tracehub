import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createSortTasksAction } from "../src/actions/production";

async function main() {
  const machine = await prisma.sortMachine.findFirst({
    where: { status: "ACTIVE", lastCalibrationStatus: "QUALIFIED" },
  });
  const pool = await prisma.holdingPool.findFirst({ where: { status: "ACTIVE" } });
  const farmer = await prisma.farmer.findFirst({ where: { status: "ACTIVE" } });
  const user = await prisma.user.findFirst();
  const group = await prisma.bundleGroup.findFirst();
  const tagClaim = await prisma.tagClaim.findFirst({ where: { status: "APPROVED" } });

  assert.ok(machine && pool && farmer && user && group && tagClaim, "请先准备基础 seed 数据");
  const enclosure = await prisma.enclosure.findFirst({ where: { farmerId: farmer.id } });
  assert.ok(enclosure, "当前养殖户缺少围网 seed 数据");

  const marker = Date.now().toString();
  const earlyCode = `YL-TESTSORT-${marker}-A`;
  const laterCode = `YL-TESTSORT-${marker}-B`;
  const earlyBundleCode = `KZD-TESTSORT-${marker}-A`;
  const earlySiblingBundleCode = `KZD-TESTSORT-${marker}-A-2`;
  const laterBundleCode = `KZD-TESTSORT-${marker}-B`;
  const earlyBase = `FJR${earlyCode.replace(/^(YL|PC)-?/, "").replace(/-/g, "")}`;
  const laterBase = `FJR${laterCode.replace(/^(YL|PC)-?/, "").replace(/-/g, "")}`;

  const earlyBatch = await prisma.batch.create({
    data: {
      code: earlyCode,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inPoolTime: new Date("1900-01-01T00:00:00Z"),
      inPoolCount: 15,
      outPoolCount: 15,
      status: "COMPLETED",
      createdById: user.id,
    },
  });
  const laterBatch = await prisma.batch.create({
    data: {
      code: laterCode,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inPoolTime: new Date("1900-01-02T00:00:00Z"),
      inPoolCount: 5,
      outPoolCount: 5,
      status: "COMPLETED",
      createdById: user.id,
    },
  });

  const earlyBundle = await prisma.bundleBatch.create({
    data: {
      code: earlyBundleCode,
      groupId: group.id,
      sourceBatchId: earlyBatch.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-TEST",
      status: "BUNDLING",
      inputCount: 10,
      qualifiedCount: 10,
      lines: {
        create: [
          { poolId: pool.id, gender: "FEMALE", weightTier: "3.0两", count: 5, qualifiedCount: 5 },
          { poolId: pool.id, gender: "MALE", weightTier: "4.0两", count: 5, qualifiedCount: 5 },
        ],
      },
    },
    include: { lines: true },
  });
  const earlySiblingBundle = await prisma.bundleBatch.create({
    data: {
      code: earlySiblingBundleCode,
      groupId: group.id,
      sourceBatchId: earlyBatch.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-TEST",
      status: "COMPLETED",
      inputCount: 5,
      qualifiedCount: 5,
      lines: {
        create: [{ poolId: pool.id, gender: "FEMALE", weightTier: "3.5两", count: 5, qualifiedCount: 5 }],
      },
    },
    include: { lines: true },
  });
  const laterBundle = await prisma.bundleBatch.create({
    data: {
      code: laterBundleCode,
      groupId: group.id,
      sourceBatchId: laterBatch.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-TEST",
      status: "COMPLETED",
      inputCount: 5,
      qualifiedCount: 5,
      lines: {
        create: [{ poolId: pool.id, gender: "FEMALE", weightTier: "3.0两", count: 5, qualifiedCount: 5 }],
      },
    },
    include: { lines: true },
  });

  const earlyFemaleLine = earlyBundle.lines.find((line) => line.gender === "FEMALE");
  const earlyMaleLine = earlyBundle.lines.find((line) => line.gender === "MALE");
  const earlySiblingFemaleLine = earlySiblingBundle.lines.find((line) => line.gender === "FEMALE");
  const laterFemaleLine = laterBundle.lines.find((line) => line.gender === "FEMALE");
  assert.ok(earlyFemaleLine && earlyMaleLine && earlySiblingFemaleLine && laterFemaleLine, "分拣 FIFO 测试规格明细准备失败");

  try {
    const blocked = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: laterBundle.id,
      items: [{ lineId: laterFemaleLine.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 5 }],
    });
    assert.equal(blocked.success, false, "前序原料仍在捆扎时，后入池原料批次必须被 FIFO 拦截");
    assert.match(blocked.message ?? "", new RegExp(earlyCode));

    await prisma.bundleBatch.update({ where: { id: earlyBundle.id }, data: { status: "COMPLETED" } });

    const wrongBundleLine = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      items: [{ lineId: laterFemaleLine.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 5 }],
    });
    assert.equal(wrongBundleLine.success, false, "跨捆扎批次伪造 lineId 必须被拦截");
    assert.match(wrongBundleLine.message ?? "", /不属于当前捆扎批次/);

    const wrongSpec = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      items: [{ lineId: earlyFemaleLine.id, gender: "MALE", weightTier: "4.0两", inputCount: 5 }],
    });
    assert.equal(wrongSpec.success, false, "lineId 与公母/规格不一致必须被拦截");
    assert.match(wrongSpec.message ?? "", /公母\/规格不一致/);

    const first = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      items: [{ lineId: earlyFemaleLine.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 5 }],
    });
    assert.equal(first.success, true, first.message);
    assert.deepEqual(first.codes, [earlyBase]);

    const stillBlocked = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: laterBundle.id,
      items: [{ lineId: laterFemaleLine.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 5 }],
    });
    assert.equal(stillBlocked.success, false, "前序原料仍有待分拣规格时，后序原料仍应被拦截");

    const second = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: earlySiblingBundle.id,
      items: [{ lineId: earlySiblingFemaleLine.id, gender: "FEMALE", weightTier: "3.5两", inputCount: 5 }],
    });
    assert.equal(second.success, true, second.message);
    assert.deepEqual(second.codes, [`${earlyBase}-2`]);

    const third = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      items: [{ lineId: earlyMaleLine.id, gender: "MALE", weightTier: "4.0两", inputCount: 5 }],
    });
    assert.equal(third.success, true, third.message);
    assert.deepEqual(third.codes, [`${earlyBase}-3`]);

    const earlyTasks = await prisma.sortTask.findMany({
      where: { bundleBatchId: { in: [earlyBundle.id, earlySiblingBundle.id] } },
      orderBy: { createdAt: "asc" },
      select: { code: true },
    });
    assert.deepEqual(earlyTasks.map((task) => task.code), [`${earlyBase}-1`, `${earlyBase}-2`, `${earlyBase}-3`]);

    const later = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: laterBundle.id,
      items: [{ lineId: laterFemaleLine.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 5 }],
    });
    assert.equal(later.success, true, later.message);
    assert.deepEqual(later.codes, [laterBase]);

    console.log("✓ 分拣 FIFO 与 FJR/KZD 编码继承规则通过");
  } finally {
    await prisma.sortTask.deleteMany({ where: { bundleBatchId: { in: [earlyBundle.id, earlySiblingBundle.id, laterBundle.id] } } });
    await prisma.bundleLine.deleteMany({ where: { bundleBatchId: { in: [earlyBundle.id, earlySiblingBundle.id, laterBundle.id] } } });
    await prisma.bundleBatch.deleteMany({ where: { id: { in: [earlyBundle.id, earlySiblingBundle.id, laterBundle.id] } } });
    await prisma.batch.deleteMany({ where: { id: { in: [earlyBatch.id, laterBatch.id] } } });
  }
}

main()
  .catch((error) => {
    console.error("❌ 分拣 FIFO 测试失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
