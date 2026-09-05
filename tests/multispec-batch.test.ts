import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createMultiSpecBatchAction } from "../src/actions/batches";

const prisma = new PrismaClient();

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 原料批次（一码单多规格）创建与异常处理回归测试");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testFarmerCode = `JD-REGR-${timestamp}`;
  const testPoolCode1 = `ZY-R1-${timestamp}`;
  const testPoolCode2 = `ZY-R2-${timestamp}`;

  try {
    // 1. 准备测试环境
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    assert.ok(admin, "必须存在管理员角色");

    const farmer = await prisma.farmer.create({
      data: {
        name: `回归测试农户_${timestamp}`,
        code: testFarmerCode,
        phone: `138${String(timestamp).slice(-8)}`,
        farmType: "STANDARD",
        area: 10,
        quota: 6000,
        year: 2026,
        status: "ACTIVE",
        enclosures: {
          create: [{ code: `W-REGR-${timestamp}`, description: "测试围网" }],
        },
      },
      include: { enclosures: true },
    });

    const pool1 = await prisma.holdingPool.create({
      data: {
        code: testPoolCode1,
        name: `测试空池1_${timestamp}`,
        status: "ACTIVE",
      },
    });

    const pool2 = await prisma.holdingPool.create({
      data: {
        code: testPoolCode2,
        name: `测试空池2_${timestamp}`,
        status: "ACTIVE",
      },
    });

    console.log("▶ [Test 1] 正常空池主从录入应该成功，返回非 undefined 的有效 batch code");
    const successRes = await createMultiSpecBatchAction({
      farmerId: farmer.id,
      enclosureId: farmer.enclosures[0].id,
      formNo: `FORM-${timestamp}`,
      items: [
        { poolId: pool1.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
        { poolId: pool2.id, gender: "FEMALE", weightTier: "3.5两", weight: 250, inPoolCount: 1000 },
      ],
      createdById: admin.id,
    });

    assert.equal(successRes.success, true, "创建应成功");
    assert.ok(successRes.code, "code 不应为 undefined");
    assert.ok(typeof successRes.code === "string" && successRes.code.startsWith("YL"), "code 应以 YL 开头");
    assert.equal(successRes.data?.inPoolCount, 2000, "入池总量应为 2000");
    console.log(`  ✔ 成功创建批次: ${successRes.code}\n`);

    console.log("▶ [Test 2] 尝试再次往已被占用的 pool1 入池新规格，应返回 success: false 且带明确隔离拦截错误");
    const pool3 = await prisma.holdingPool.create({
      data: {
        code: `ZY-R3-${timestamp}`,
        name: `测试空池3_${timestamp}`,
        status: "ACTIVE",
      },
    });

    const conflictRes = await createMultiSpecBatchAction({
      farmerId: farmer.id,
      enclosureId: farmer.enclosures[0].id,
      formNo: `FORM-CONFLICT-${timestamp}`,
      items: [
        { poolId: pool1.id, gender: "MALE", weightTier: "4.0两", weight: 150, inPoolCount: 500 },
        { poolId: pool3.id, gender: "FEMALE", weightTier: "3.5两", weight: 150, inPoolCount: 500 },
      ],
      createdById: admin.id,
    });

    assert.equal(conflictRes.success, false, "有在养存量的池禁止混入新批次，应返回 false");
    assert.ok(conflictRes.error?.includes("暂养池批次隔离拦截"), `错误信息应包含暂养池隔离拦截，实际: ${conflictRes.error}`);
    assert.equal(conflictRes.code, undefined, "失败时 code 为 undefined，前端切勿误当作成功提示");
    console.log(`  ✔ 成功拦截混池，错误提示: ${conflictRes.error}\n`);

    console.log("▶ [Test 3] 批次编码序号冲突防碰撞测试（若存在序号断号或跳号，必须自动递增到唯一可用编号，不能崩溃报错）");
    const pool4 = await prisma.holdingPool.create({
      data: { code: `ZY-R4-${timestamp}`, name: `测试空池4_${timestamp}`, status: "ACTIVE" },
    });
    const pool5 = await prisma.holdingPool.create({
      data: { code: `ZY-R5-${timestamp}`, name: `测试空池5_${timestamp}`, status: "ACTIVE" },
    });

    // 假设当日只有一条批次且编号为 YL...02 (模拟01被删除或人工占号情况)
    // 先清理刚才创建的 01 批次，然后强行创建一个 02 批次
    await prisma.batchItem.deleteMany({ where: { batch: { code: successRes.code! } } });
    await prisma.auditLog.deleteMany({ where: { details: { contains: successRes.code! } } });
    await prisma.batch.delete({ where: { code: successRes.code! } });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const collisionDummyCode = `YL${dateStr}88`;

    await prisma.batchItem.deleteMany({ where: { batch: { code: collisionDummyCode } } });
    await prisma.auditLog.deleteMany({ where: { details: { contains: collisionDummyCode } } });
    await prisma.batch.deleteMany({ where: { code: collisionDummyCode } });

    const dummyBatch = await prisma.batch.create({
      data: {
        code: collisionDummyCode,
        farmerId: farmer.id,
        enclosureId: farmer.enclosures[0].id,
        poolId: pool1.id,
        gender: "MALE",
        weightTier: "4.0两",
        inPoolCount: 100,
        createdById: admin.id,
      },
    });

    const nonCollidingRes = await createMultiSpecBatchAction({
      farmerId: farmer.id,
      enclosureId: farmer.enclosures[0].id,
      formNo: `FORM-NO-COLLIDE-${timestamp}`,
      items: [
        { poolId: pool4.id, gender: "MALE", weightTier: "4.0两", weight: 100, inPoolCount: 500 },
        { poolId: pool5.id, gender: "FEMALE", weightTier: "3.5两", weight: 100, inPoolCount: 500 },
      ],
      createdById: admin.id,
    });

    assert.equal(nonCollidingRes.success, true, `发生断号时不应产生唯一键冲突崩溃: ${nonCollidingRes.error}`);
    assert.notEqual(nonCollidingRes.code, collisionDummyCode, "生成的编码不能与现有编码冲突");
    assert.equal(nonCollidingRes.code, `YL${dateStr}89`, `应自动递增至下一个可用序号 89，实际: ${nonCollidingRes.code}`);
    console.log(`  ✔ 自动避碰成功，生成的新批次号为: ${nonCollidingRes.code}\n`);

    // 清理 dummyBatch 和 nonCollidingBatch
    await prisma.batchItem.deleteMany({ where: { batch: { code: nonCollidingRes.code! } } });
    await prisma.auditLog.deleteMany({ where: { details: { contains: nonCollidingRes.code! } } });
    await prisma.batch.delete({ where: { code: nonCollidingRes.code! } });
    await prisma.batch.delete({ where: { id: dummyBatch.id } });
    await prisma.holdingPool.deleteMany({
      where: { code: { in: [`ZY-R4-${timestamp}`, `ZY-R5-${timestamp}`] } },
    });
    // 清理创建的池和农户
    await prisma.holdingPool.deleteMany({
      where: { code: { in: [testPoolCode1, testPoolCode2, `ZY-R3-${timestamp}`] } },
    });
    await prisma.enclosure.deleteMany({ where: { farmerId: farmer.id } });
    await prisma.farmer.delete({ where: { id: farmer.id } });

    console.log("🎉 全部回归测试通过！");
  } catch (err) {
    console.error("❌ 回归测试失败:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
