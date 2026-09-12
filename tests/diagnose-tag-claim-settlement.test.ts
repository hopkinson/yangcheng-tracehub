import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createStoreOutboundAction } from "../src/actions/outbound";
import { approveOutboundOrderAction } from "../src/actions/approvals";

const prisma = new PrismaClient();

async function testTagClaimSettlementRepro() {
  console.log("=== Diagnosing Bug: Multi-spec outbound tag claim settlement ===");
  const ts = Date.now();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin");

  const channel = await prisma.channel.findFirst();
  if (!channel) throw new Error("No channel");

  const store = await prisma.store.create({
    data: {
      code: `ST-DIAG-${ts}`,
      name: `测试门店-${ts}`,
      channelId: channel.id,
    },
  });

  // 1. Farmer A (张三-4两)
  const farmerA = await prisma.farmer.create({
    data: {
      code: `JD-A-${ts}`,
      name: `张三-4两-${ts}`,
      phone: `138${String(ts).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
      enclosures: { create: [{ code: `W-A-${ts}`, description: "东湖测试网A" }] },
    },
    include: { enclosures: true },
  });

  const poolA = await prisma.holdingPool.create({
    data: {
      code: `ZY-A-${ts}`,
      name: `池A-${ts}`,
      status: "ACTIVE",
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  const batchA = await prisma.batch.create({
    data: {
      code: `PC-A-${ts}`,
      farmerId: farmerA.id,
      enclosureId: farmerA.enclosures[0].id,
      poolId: poolA.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 500,
      outPoolCount: 320,
      lossCount: 0,
      createdById: admin.id,
      status: "PARTIALLY_OUTBOUND",
    },
  });

  const tagClaimA = await prisma.tagClaim.create({
    data: {
      code: `XK-A-${ts}`,
      claimDate: new Date(),
      farmerId: farmerA.id,
      claimCount: 320,
      boundCount: 0,
      status: "APPROVED",
      applicantId: admin.id,
      approverId: admin.id,
    },
  });

  const groupA = await prisma.bundleGroup.create({ data: { code: `P-A-${ts}`, name: `组A-${ts}` } });
  const bundleA = await prisma.bundleBatch.create({
    data: {
      code: `KZD-A-${ts}`,
      groupId: groupA.id,
      tagClaimId: tagClaimA.id,
      ropeBatch: `XS-A-${ts}`,
      inputCount: 320,
      qualifiedCount: 320,
      status: "COMPLETED",
    },
  });

  const machineA = await prisma.sortMachine.create({ data: { code: `FJ-A-${ts}`, name: "分拣机A", status: "ACTIVE" } });
  const sortTaskA = await prisma.sortTask.create({
    data: {
      code: `FJR-A-${ts}`,
      machineId: machineA.id,
      bundleBatchId: bundleA.id,
      gender: "MALE",
      weightTier: "4.0两",
      inputCount: 320,
      qualifiedCount: 320,
      status: "COMPLETED",
    },
  });

  // 2. Farmer B (李四-3两)
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

  const batchB = await prisma.batch.create({
    data: {
      code: `PC-B-${ts}`,
      farmerId: farmerB.id,
      enclosureId: farmerB.enclosures[0].id,
      poolId: poolB.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inPoolCount: 500,
      outPoolCount: 320,
      lossCount: 0,
      createdById: admin.id,
      status: "PARTIALLY_OUTBOUND",
    },
  });

  const tagClaimB = await prisma.tagClaim.create({
    data: {
      code: `XK-B-${ts}`,
      claimDate: new Date(),
      farmerId: farmerB.id,
      claimCount: 320,
      boundCount: 0,
      status: "APPROVED",
      applicantId: admin.id,
      approverId: admin.id,
    },
  });

  const groupB = await prisma.bundleGroup.create({ data: { code: `P-B-${ts}`, name: `组B-${ts}` } });
  const bundleB = await prisma.bundleBatch.create({
    data: {
      code: `KZD-B-${ts}`,
      groupId: groupB.id,
      tagClaimId: tagClaimB.id,
      ropeBatch: `XS-B-${ts}`,
      inputCount: 320,
      qualifiedCount: 320,
      status: "COMPLETED",
    },
  });

  const sortTaskB = await prisma.sortTask.create({
    data: {
      code: `FJR-B-${ts}`,
      machineId: machineA.id,
      bundleBatchId: bundleB.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inputCount: 320,
      qualifiedCount: 320,
      status: "COMPLETED",
    },
  });

  // Cold store & logs
  const coldStore = await prisma.coldStore.create({ data: { code: `BX-${ts}`, name: "保鲜库" } });
  const coldLogA = await prisma.coldLog.create({
    data: { code: `CR-A-${ts}`, storeId: coldStore.id, type: "INTAKE", count: 320, refType: "SORT", refId: sortTaskA.code, operator: "仓管" },
  });
  const coldLogB = await prisma.coldLog.create({
    data: { code: `CR-B-${ts}`, storeId: coldStore.id, type: "INTAKE", count: 320, refType: "SORT", refId: sortTaskB.code, operator: "仓管" },
  });

  // Store Orders
  const orderA = await prisma.order.create({
    data: {
      code: `SO-A-${ts}`,
      importId: `IM-${ts}`,
      orderNo: `SO${ts}-示范-4.0公`,
      type: "STORE_ORDER",
      storeId: store.id,
      gender: "MALE",
      weightTier: "4.0两",
      count: 320,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  const orderB = await prisma.order.create({
    data: {
      code: `SO-B-${ts}`,
      importId: `IM-${ts}`,
      orderNo: `SO${ts}-示范-3.0母`,
      type: "STORE_ORDER",
      storeId: store.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      count: 320,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  const specBatchMap = {
    "MALE_4.0两": coldLogA.id,
    "FEMALE_3.0两": coldLogB.id,
  };

  // Create Outbound Order combining both
  const outboundRes = await createStoreOutboundAction({
    storeId: store.id,
    orderIds: [orderA.id, orderB.id],
    specBatchMap,
    transportCompany: "冷链专车",
    contactName: "测试联系人",
    contactPhone: "13800000000",
    applicantId: admin.id,
  });

  console.log("Created Outbound Order:", outboundRes.code, "Total count:", outboundRes.outboundCount);

  // Now QA / Admin approves the outbound order
  await approveOutboundOrderAction({
    orderId: outboundRes.id,
    approved: true,
    comment: "同意出库",
    approverId: admin.id,
  });

  // Verify tag claims
  const updatedClaimA = await prisma.tagClaim.findUniqueOrThrow({ where: { id: tagClaimA.id } });
  const updatedClaimB = await prisma.tagClaim.findUniqueOrThrow({ where: { id: tagClaimB.id } });

  console.log(`Claim A (${farmerA.name}): boundCount=${updatedClaimA.boundCount}, isBalanced=${updatedClaimA.isBalanced}`);
  console.log(`Claim B (${farmerB.name}): boundCount=${updatedClaimB.boundCount}, isBalanced=${updatedClaimB.isBalanced}`);

  // Assertions
  assert.equal(updatedClaimA.boundCount, 320, "张三 (4.0两公蟹) 绑扣核销数应为 320");
  assert.equal(updatedClaimA.isBalanced, true, "张三 蟹扣应已轧平");

  assert.equal(updatedClaimB.boundCount, 320, "李四 (3.0两母蟹) 绑扣核销数应为 320");
  assert.equal(updatedClaimB.isBalanced, true, "李四 蟹扣应已轧平");

  console.log("✔ 测试通过：张三与李四蟹扣均成功核销轧平！");
}

testTagClaimSettlementRepro()
  .catch((err) => {
    console.error(">>> REPRO FAILED <<<", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
