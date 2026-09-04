import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createMultiSpecBatchAction } from "../src/actions/batches";

const prisma = new PrismaClient();

async function runTests() {
  console.log("🧪 开始测试一码单多规格入池 (createMultiSpecBatchAction)...");

  const timestamp = Date.now();
  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-TEST-${timestamp}`,
      name: `测试养殖户-${timestamp}`,
      phone: `138${String(timestamp).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
      status: "ACTIVE",
      enclosures: {
        create: [{ code: `W-TEST-${timestamp}`, description: "测试围网" }],
      },
    },
    include: { enclosures: true },
  });

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert.ok(admin, "Admin user must exist");

  const poolOccupied = await prisma.holdingPool.create({
    data: {
      code: `ZY-OCC-${timestamp}`,
      name: `占用池-${timestamp}`,
      status: "ACTIVE",
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  // Put 1000 crabs directly into poolOccupied
  await prisma.batch.create({
    data: {
      code: `PC-OCC-${timestamp}`,
      farmerId: farmer.id,
      enclosureId: farmer.enclosures[0].id,
      poolId: poolOccupied.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 1000,
      createdById: admin.id,
    },
  });

  const poolEmpty1 = await prisma.holdingPool.create({
    data: { code: `ZY-EMP1-${timestamp}`, name: `空池1-${timestamp}`, status: "ACTIVE" },
  });
  const poolEmpty2 = await prisma.holdingPool.create({
    data: { code: `ZY-EMP2-${timestamp}`, name: `空池2-${timestamp}`, status: "ACTIVE" },
  });

  console.log("▶ [Test 1] 校验防混池拦截：向已有在养存量的池入池必须返回友好的业务拦截提示");
  const resOccupied = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    formNo: "YCGF-TEST-001",
    temp: 18.5,
    humidity: 85.0,
    escort: "测试员",
    items: [
      { poolId: poolOccupied.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
    ],
    createdById: admin.id,
  });

  assert.strictEqual(resOccupied.success, false, "Should fail when pool is occupied");
  assert.match(resOccupied.error || "", /暂养池批次隔离拦截|已有在养存量/, "Error message must be clear and not masked");
  console.log("  ✔ 已有在养存量混池拦截测试通过，返回错误信息:", resOccupied.error);

  console.log("▶ [Test 2] 校验正常空池录入：多规格明细成功写入主从结构");
  const resSuccess = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    formNo: "YCGF-TEST-002",
    temp: 18.5,
    humidity: 85.0,
    escort: "测试员",
    items: [
      { poolId: poolEmpty1.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
      { poolId: poolEmpty2.id, gender: "FEMALE", weightTier: "3.5两", weight: 300, inPoolCount: 1000 },
    ],
    createdById: admin.id,
  });

  assert.strictEqual(resSuccess.success, true, `Should succeed: ${resSuccess.error}`);
  assert.ok(resSuccess.data?.code, "Must have batch code");
  console.log("  ✔ 正常多规格批次创建成功，批次号:", resSuccess.data?.code);

  console.log("▶ [Test 3] 校验批次号唯一性防冲突：连续多次创建不会产生 duplicate code");
  const poolEmpty3 = await prisma.holdingPool.create({
    data: { code: `ZY-EMP3-${timestamp}`, name: `空池3-${timestamp}`, status: "ACTIVE" },
  });
  const resSuccess2 = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    formNo: "YCGF-TEST-003",
    items: [
      { poolId: poolEmpty3.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
    ],
    createdById: admin.id,
  });
  assert.strictEqual(resSuccess2.success, true, `Should succeed: ${resSuccess2.error}`);
  assert.notStrictEqual(resSuccess.data?.code, resSuccess2.data?.code, "Batch codes must be distinct");
  console.log("  ✔ 批次号不重复:", resSuccess2.data?.code);

  console.log("▶ [Test 4] 校验超额入池拦截");
  const poolEmpty4 = await prisma.holdingPool.create({
    data: { code: `ZY-EMP4-${timestamp}`, name: `空池4-${timestamp}`, status: "ACTIVE" },
  });
  const resOverQuota = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    items: [
      { poolId: poolEmpty4.id, gender: "MALE", weightTier: "4.0两", weight: 1500, inPoolCount: 5000 }, // 1000 + 2000 + 1000 + 5000 = 9000 > 6000
    ],
    createdById: admin.id,
  });
  assert.strictEqual(resOverQuota.success, false, "Should fail when quota exceeded");
  assert.match(resOverQuota.error || "", /超出年度额度/, "Must report quota error");
  console.log("  ✔ 超额拦截通过:", resOverQuota.error);

  console.log("\n🎉 一码单多规格入池自动化测试全部通过！");
}

runTests()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
