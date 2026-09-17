import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { batchCompleteSortTasksAction } from "../src/actions/production";

async function main() {
  console.log("▶ [Test Batch Sort Complete] 验证分拣任务批量确认与损耗核算...");

  const machine = await prisma.sortMachine.findFirst({
    where: { status: "ACTIVE", lastCalibrationStatus: "QUALIFIED" },
  });
  const bundle = await prisma.bundleBatch.findFirst({
    where: { status: "COMPLETED" },
  });

  assert.ok(machine && bundle, "需要基础 seed 数据");

  const marker = Date.now().toString();
  const task1 = await prisma.sortTask.create({
    data: {
      code: `FJR-BATCH-TEST-${marker}-1`,
      machineId: machine.id,
      bundleBatchId: bundle.id,
      gender: "FEMALE",
      weightTier: "2.5两",
      inputCount: 60,
      status: "PENDING",
    },
  });

  const task2 = await prisma.sortTask.create({
    data: {
      code: `FJR-BATCH-TEST-${marker}-2`,
      machineId: machine.id,
      bundleBatchId: bundle.id,
      gender: "MALE",
      weightTier: "3.5两",
      inputCount: 60,
      status: "PENDING",
    },
  });

  // 1. 测试超额合格输入被拦截
  const overResult = await batchCompleteSortTasksAction([
    { taskId: task1.id, qualifiedCount: 65 },
    { taskId: task2.id, qualifiedCount: 60 },
  ]);
  assert.equal(overResult.success, false, "超过投入只数应该被拦截");

  // 2. 正常批量结算
  const okResult = await batchCompleteSortTasksAction([
    { taskId: task1.id, qualifiedCount: 58 }, // 损耗 2 只
    { taskId: task2.id, qualifiedCount: 60 }, // 损耗 0 只
  ]);
  assert.equal(okResult.success, true, "正常批量结算应该成功");

  const updated1 = await prisma.sortTask.findUnique({ where: { id: task1.id } });
  const updated2 = await prisma.sortTask.findUnique({ where: { id: task2.id } });

  assert.equal(updated1?.status, "COMPLETED");
  assert.equal(updated1?.qualifiedCount, 58);
  assert.equal(updated1?.lossCount, 2);

  assert.equal(updated2?.status, "COMPLETED");
  assert.equal(updated2?.qualifiedCount, 60);
  assert.equal(updated2?.lossCount, 0);

  // 清理测试临时任务
  await prisma.sortTask.deleteMany({
    where: { id: { in: [task1.id, task2.id] } },
  });

  console.log("✔ 分拣任务批量确认与损耗核算测试 100% 通过！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
