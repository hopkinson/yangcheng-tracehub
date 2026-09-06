import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createSortTasksAction } from "../src/actions/production";

async function testSortTaskRepeatSelection() {
  console.log("▶ [Diagnosing Bugs] 验证分拣任务创建后来源捆扎批次不可重复选择与余量守恒...");

  let machine = await prisma.sortMachine.findFirst({
    where: { status: "ACTIVE", lastCalibrationStatus: "QUALIFIED" },
  });
  if (!machine) {
    machine = await prisma.sortMachine.create({
      data: {
        code: "FJ-TEST-" + Date.now(),
        name: "测试分拣机",
        status: "ACTIVE",
        lastCalibrationStatus: "QUALIFIED",
      },
    });
  }

  const pool = (await prisma.holdingPool.findFirst({ where: { status: "ACTIVE" } })) ||
    (await prisma.holdingPool.create({
      data: { code: "ZY-TEST", name: "测试暂养池", status: "ACTIVE" },
    }));

  const farmer = (await prisma.farmer.findFirst()) ||
    (await prisma.farmer.create({
      data: { name: "测试农户", code: "FH-TEST", area: 10, quota: 6000, farmType: "LAKE_CRAB", year: 2026, phone: "13800000000" },
    }));

  const user = (await prisma.user.findFirst()) ||
    (await prisma.user.create({
      data: { username: "tester", fullName: "测试员", phone: "13800000000", role: "ADMIN", passwordHash: "dummy" },
    }));

  const group = (await prisma.bundleGroup.findFirst()) ||
    (await prisma.bundleGroup.create({
      data: { code: "P99", name: "测试捆扎组", status: "IDLE" },
    }));

  const tagClaim = (await prisma.tagClaim.findFirst({ where: { status: "APPROVED" } })) ||
    (await prisma.tagClaim.create({
      data: {
        code: "XK-TEST-" + Date.now(),
        claimDate: new Date(),
        farmerId: farmer.id,
        claimCount: 1000,
        status: "APPROVED",
        applicantId: user.id,
      },
    }));

  const testBundleCode = `KZD-TEST-${Date.now()}`;
  const testBundle = await prisma.bundleBatch.create({
    data: {
      code: testBundleCode,
      groupId: group.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-TEST",
      status: "COMPLETED",
      inputCount: 315,
      qualifiedCount: 315,
      lines: {
        create: [
          {
            poolId: pool.id,
            gender: "FEMALE",
            weightTier: "3.0两",
            count: 315,
            qualifiedCount: 315,
          },
        ],
      },
    },
    include: { lines: true },
  });

  const lineId = testBundle.lines[0].id;

  try {
    console.log("1. 第一次创建分拣任务，投入全部 315 只...");
    const firstRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: testBundle.id,
      items: [
        {
          lineId,
          gender: "FEMALE",
          weightTier: "3.0两",
          inputCount: 315,
        },
      ],
    });

    assert.equal(firstRes.success, true, `首次建单应成功: ${firstRes.message}`);
    console.log("  ✔ 首次建单成功:", firstRes.message);

    console.log("2. 尝试二次建单（此时已全部分拣，余量应为 0）...");
    const secondRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: testBundle.id,
      items: [
        {
          lineId,
          gender: "FEMALE",
          weightTier: "3.0两",
          inputCount: 315,
        },
      ],
    });

    assert.equal(
      secondRes.success,
      false,
      `该批次规格已全部分拣建单，余量为0，再次建单必须被系统拦截！但实际上却成功了: ${JSON.stringify(secondRes)}`
    );
    console.log("  ✔ 二次建单成功被拦截:", secondRes.message);
  } finally {
    await prisma.sortTask.deleteMany({ where: { bundleBatchId: testBundle.id } });
    await prisma.bundleLine.deleteMany({ where: { bundleBatchId: testBundle.id } });
    await prisma.bundleBatch.delete({ where: { id: testBundle.id } });
  }
}

testSortTaskRepeatSelection().catch((err) => {
  console.error("❌ 测试失败:", err.message);
  process.exit(1);
});
