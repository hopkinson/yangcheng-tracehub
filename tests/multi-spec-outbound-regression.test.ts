import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createStoreOutboundAction } from "../src/actions/outbound";

const prisma = new PrismaClient();

async function runRepro() {
  console.log("=== Testing Minimal Reproduction for Completed Batches ===");
  const ts = Date.now();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin");

  const channel = await prisma.channel.findFirst();
  const store = await prisma.store.create({
    data: {
      code: `ST-BUG-${ts}`,
      name: `示范店-${ts}`,
      channelId: channel!.id,
    },
  });

  // Farmer A: 张三-4两
  const farmerA = await prisma.farmer.create({
    data: {
      code: `JD-A-${ts}`,
      name: `张三-4两-${ts}`,
      phone: `138${String(ts).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
      enclosures: { create: [{ code: `W-A-${ts}`, description: "东湖测试网" }] },
    },
    include: { enclosures: true },
  });

  // Pool A
  const poolA = await prisma.holdingPool.create({
    data: {
      code: `ZY-A-${ts}`,
      name: `池A-${ts}`,
      status: "ACTIVE",
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  // Batch A: Status COMPLETED (because all crabs out to bundling)
  const batchA = await prisma.batch.create({
    data: {
      code: `PC-A-${ts}`,
      farmerId: farmerA.id,
      enclosureId: farmerA.enclosures[0].id,
      poolId: poolA.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 500,
      outPoolCount: 500,
      lossCount: 0,
      createdById: admin.id,
      status: "COMPLETED",
    },
  });

  // Farmer B: 李四-3两
  const farmerB = await prisma.farmer.create({
    data: {
      code: `JD-B-${ts}`,
      name: `李四-3两-${ts}`,
      phone: `139${String(ts).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
      enclosures: { create: [{ code: `W-B-${ts}`, description: "东湖测试网B" }] },
    },
    include: { enclosures: true },
  });

  const poolB = await prisma.holdingPool.create({
    data: {
      code: `ZY-B-${ts}`,
      name: `池B-${ts}`,
      status: "ACTIVE",
      currentGender: "FEMALE",
      currentWeightTier: "3.0两",
    },
  });

  // Batch B: Status COMPLETED
  const batchB = await prisma.batch.create({
    data: {
      code: `PC-B-${ts}`,
      farmerId: farmerB.id,
      enclosureId: farmerB.enclosures[0].id,
      poolId: poolB.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inPoolCount: 500,
      outPoolCount: 500,
      lossCount: 0,
      createdById: admin.id,
      status: "COMPLETED",
    },
  });

  // Bundling & Sorting for A
  const tagClaimA = await prisma.tagClaim.create({
    data: { code: `XK-A-${ts}`, claimDate: new Date(), farmerId: farmerA.id, claimCount: 500, boundCount: 500, status: "APPROVED", applicantId: admin.id },
  });
  const groupA = await prisma.bundleGroup.create({ data: { code: `P-A-${ts}`, name: `组A-${ts}` } });
  const bundleA = await prisma.bundleBatch.create({
    data: { code: `KZD-A-${ts}`, groupId: groupA.id, tagClaimId: tagClaimA.id, ropeBatch: `XS-A-${ts}`, status: "COMPLETED" },
  });
  const machineA = await prisma.sortMachine.create({ data: { code: `FJ-A-${ts}`, name: "分拣机A", status: "ACTIVE" } });
  const sortTaskA = await prisma.sortTask.create({
    data: { code: `FJR-A-${ts}`, machineId: machineA.id, bundleBatchId: bundleA.id, gender: "MALE", weightTier: "4.0两", inputCount: 500, qualifiedCount: 312, status: "COMPLETED" },
  });

  // Bundling & Sorting for B
  const tagClaimB = await prisma.tagClaim.create({
    data: { code: `XK-B-${ts}`, claimDate: new Date(), farmerId: farmerB.id, claimCount: 500, boundCount: 500, status: "APPROVED", applicantId: admin.id },
  });
  const groupB = await prisma.bundleGroup.create({ data: { code: `P-B-${ts}`, name: `组B-${ts}` } });
  const bundleB = await prisma.bundleBatch.create({
    data: { code: `KZD-B-${ts}`, groupId: groupB.id, tagClaimId: tagClaimB.id, ropeBatch: `XS-B-${ts}`, status: "COMPLETED" },
  });
  const sortTaskB = await prisma.sortTask.create({
    data: { code: `FJR-B-${ts}`, machineId: machineA.id, bundleBatchId: bundleB.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 500, qualifiedCount: 312, status: "COMPLETED" },
  });

  // Cold store & logs
  const coldStore = await prisma.coldStore.create({ data: { code: `BX-A-${ts}`, name: "保鲜库" } });
  const coldLogA = await prisma.coldLog.create({
    data: { code: `CR-0902-${ts}`, storeId: coldStore.id, type: "INTAKE", count: 312, refType: "SORT", refId: sortTaskA.code, operator: "仓管" },
  });
  const coldLogB = await prisma.coldLog.create({
    data: { code: `CR-0901-${ts}`, storeId: coldStore.id, type: "INTAKE", count: 312, refType: "SORT", refId: sortTaskB.code, operator: "仓管" },
  });

  // Orders:
  // Order 1: 3.0两 母蟹 300只
  const order1 = await prisma.order.create({
    data: {
      code: `SO-1-${ts}`,
      importId: `IM-${ts}`,
      orderNo: `SO${ts}-示范-3.0母`,
      type: "STORE_ORDER",
      storeId: store.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      count: 300,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  // Order 2: 4.0两 公蟹 300只
  const order2 = await prisma.order.create({
    data: {
      code: `SO-2-${ts}`,
      importId: `IM-${ts}`,
      orderNo: `SO${ts}-示范-4.0公`,
      type: "STORE_ORDER",
      storeId: store.id,
      gender: "MALE",
      weightTier: "4.0两",
      count: 300,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  // Mark all existing batches to COMPLETED so only these exist
  await prisma.batch.updateMany({
    where: { status: { not: "COMPLETED" } },
    data: { status: "COMPLETED" },
  });

  // Now construct specBatchMap as the frontend does:
  // Frontend sorts demands: MALE first, then FEMALE
  const specBatchMap = {
    "MALE_4.0两": coldLogA.id,
    "FEMALE_3.0两": coldLogB.id,
  };

  console.log("Testing createStoreOutboundAction with [order1 (FEMALE 3.0两), order2 (MALE 4.0两)] and specBatchMap...");
  try {
    const res = await createStoreOutboundAction({
      storeId: store.id,
      orderIds: [order1.id, order2.id],
      specBatchMap,
      transportCompany: "苏州市冷链物流专车",
      contactName: "测试联系人",
      contactPhone: "13800000000",
      applicantId: admin.id,
    });
    assert.ok(res.id, "出库单应成功生成");
    assert.equal(res.outboundCount, 600, "出库总数应为600只");
    assert.ok(res.batchId, "原料批次关联应合法");
    console.log("✔ 多规格门店合单出库回归测试通过，批次号:", res.code, "关联原料批次:", res.batchId);
  } catch (err: any) {
    console.error(">>> ERROR <<<", err);
    throw err;
  }
}

runRepro().finally(() => prisma.$disconnect());
