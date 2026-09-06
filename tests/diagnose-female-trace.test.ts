import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { resolveTraceQuery } from "../src/lib/trace-service";
import { createStoreOutboundAction } from "../src/actions/outbound";

async function runTest() {
  console.log("🔍 [Phase 1/2] 验证母蟹全链路追溯（捆扎、分拣、预冷）规格对齐测试...\n");

  const ts = Date.now();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user found");

  const channel = await prisma.channel.findFirstOrThrow();
  const store = await prisma.store.create({
    data: { code: `ST-${ts}`, name: `示范店-${ts}`, channelId: channel.id },
  });

  // Farmer A: 张三-4两 (MALE)
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
      outPoolCount: 500,
      lossCount: 0,
      createdById: admin.id,
      status: "COMPLETED",
    },
  });

  // Farmer B: 李四-3两 (FEMALE)
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
      outPoolCount: 500,
      lossCount: 0,
      createdById: admin.id,
      status: "COMPLETED",
    },
  });

  // Bundling & Sorting for A (Male)
  const tagClaimA = await prisma.tagClaim.create({
    data: { code: `XK-A-${ts}`, claimDate: new Date(), farmerId: farmerA.id, claimCount: 500, boundCount: 500, status: "APPROVED", applicantId: admin.id },
  });
  const groupA = await prisma.bundleGroup.create({ data: { code: `P-A-${ts}`, name: `P1组 公-${ts}` } });
  const bundleA = await prisma.bundleBatch.create({
    data: { code: `KZD-A-${ts}`, groupId: groupA.id, tagClaimId: tagClaimA.id, ropeBatch: `XS-A-${ts}`, status: "COMPLETED", doneAt: new Date() },
  });
  const machineA = await prisma.sortMachine.create({ data: { code: `FJ-A-${ts}`, name: "分拣机A", status: "ACTIVE" } });
  const sortTaskA = await prisma.sortTask.create({
    data: { code: `FJR-A-${ts}`, machineId: machineA.id, bundleBatchId: bundleA.id, gender: "MALE", weightTier: "4.0两", inputCount: 500, qualifiedCount: 312, status: "COMPLETED", doneAt: new Date() },
  });

  // Bundling & Sorting for B (Female)
  const tagClaimB = await prisma.tagClaim.create({
    data: { code: `XK-B-${ts}`, claimDate: new Date(), farmerId: farmerB.id, claimCount: 500, boundCount: 500, status: "APPROVED", applicantId: admin.id },
  });
  const groupB = await prisma.bundleGroup.create({ data: { code: `P-B-${ts}`, name: `P2组 母-${ts}` } });
  const bundleB = await prisma.bundleBatch.create({
    data: { code: `KZD-B-${ts}`, groupId: groupB.id, tagClaimId: tagClaimB.id, ropeBatch: `XS-B-${ts}`, status: "COMPLETED", doneAt: new Date() },
  });
  const machineB = await prisma.sortMachine.create({ data: { code: `FJ-B-${ts}`, name: "分拣机B", status: "ACTIVE" } });
  const sortTaskB = await prisma.sortTask.create({
    data: { code: `FJR-B-${ts}`, machineId: machineB.id, bundleBatchId: bundleB.id, gender: "FEMALE", weightTier: "3.0两", inputCount: 500, qualifiedCount: 312, status: "COMPLETED", doneAt: new Date() },
  });

  // Cold store & logs
  const coldStore = await prisma.coldStore.create({ data: { code: `BX-A-${ts}`, name: "保鲜库", targetTemp: 4.0 } });
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

  // 执行门店出库申请 (带 specBatchMap)
  const outboundRes = await createStoreOutboundAction({
    storeId: store.id,
    orderIds: [order1.id, order2.id],
    specBatchMap: {
      "FEMALE_3.0两": coldLogB.id,
      "MALE_4.0两": coldLogA.id,
    },
    applicantId: admin.id,
  });

  console.log("出库单创建结果:", outboundRes.code);

  // 10. 追溯查询该出库单
  const trace = await resolveTraceQuery(outboundRes.code);
  assert.ok(trace, "应能查到出库单溯源结果");
  console.log("追溯明细数量:", trace.lines.length);

  const lineFemale = trace.lines.find((l) => l.gender === "FEMALE");
  assert.ok(lineFemale, "应包含母蟹明细行");

  console.log("\n▶ 母蟹明细溯源节点输出:");
  for (const node of lineFemale.chain) {
    console.log(`  Step ${node.step} [${node.stageName}]: ${node.title} | ${node.subtitle}`);
  }

  // 环节 3 (捆扎) 必须是母蟹的捆扎批次与母蟹班组
  const bundleStep = lineFemale.chain.find((n) => n.step === 3);
  assert.ok(bundleStep, "应有捆扎环节");
  assert.ok(
    bundleStep.title.includes(bundleB.code) && bundleStep.title.includes(groupB.name),
    `母蟹捆扎应为 ${bundleB.code} · ${groupB.name}，实际为: ${bundleStep.title}`
  );

  // 环节 4 (分拣) 必须是母蟹的分拣任务与母蟹分拣机
  const sortStep = lineFemale.chain.find((n) => n.step === 4);
  assert.ok(sortStep, "应有分拣环节");
  assert.ok(
    sortStep.title.includes(sortTaskB.code) && sortStep.title.includes(machineB.name),
    `母蟹分拣应为 ${sortTaskB.code} · ${machineB.name}，实际为: ${sortStep.title}`
  );

  // 环节 5 (预冷) 必须是母蟹的保鲜入库单 CR-0901
  const coldStep = lineFemale.chain.find((n) => n.step === 5);
  assert.ok(coldStep, "应有预冷环节");
  assert.ok(
    coldStep.subtitle.includes(coldLogB.code),
    `母蟹预冷应为 ${coldLogB.code}，实际为: ${coldStep.subtitle}`
  );

  const lineMale = trace.lines.find((l) => l.gender === "MALE");
  assert.ok(lineMale, "应包含公蟹明细行");

  console.log("\n▶ 公蟹明细溯源节点输出:");
  for (const node of lineMale.chain) {
    console.log(`  Step ${node.step} [${node.stageName}]: ${node.title} | ${node.subtitle}`);
  }

  // 环节 3 (捆扎) 必须是公蟹的捆扎批次与公蟹班组
  const bundleStepM = lineMale.chain.find((n) => n.step === 3);
  assert.ok(bundleStepM, "应有捆扎环节");
  assert.ok(
    bundleStepM.title.includes(bundleA.code) && bundleStepM.title.includes(groupA.name),
    `公蟹捆扎应为 ${bundleA.code} · ${groupA.name}，实际为: ${bundleStepM.title}`
  );

  // 环节 4 (分拣) 必须是公蟹的分拣任务与公蟹分拣机
  const sortStepM = lineMale.chain.find((n) => n.step === 4);
  assert.ok(sortStepM, "应有分拣环节");
  assert.ok(
    sortStepM.title.includes(sortTaskA.code) && sortStepM.title.includes(machineA.name),
    `公蟹分拣应为 ${sortTaskA.code} · ${machineA.name}，实际为: ${sortStepM.title}`
  );

  // 环节 5 (预冷) 必须是公蟹的保鲜入库单 CR-0902
  const coldStepM = lineMale.chain.find((n) => n.step === 5);
  assert.ok(coldStepM, "应有预冷环节");
  assert.ok(
    coldStepM.subtitle.includes(coldLogA.code),
    `公蟹预冷应为 ${coldLogA.code}，实际为: ${coldStepM.subtitle}`
  );

  console.log("\n🔍 [Phase 2] 模拟生产环境无 specBatchMap 且出库单仅绑定公蟹 coldLog 时的母蟹防串溯源测试...");
  // 创建一个仅挂靠公蟹 coldLogA、且无 auditLog specBatchMap 的多规格出库单
  const obDirect = await prisma.outboundOrder.create({
    data: {
      code: `CK-DIRECT-${ts}`,
      type: "STORE_ORDER",
      storeId: store.id,
      channelId: channel.id,
      storeName: store.name,
      batchId: batchA.id,
      coldLogId: coldLogA.id, // 仅挂靠公蟹预冷批次！
      outboundCount: 600,
      status: "APPROVED",
      applicantId: admin.id,
      approverId: admin.id,
      approvedAt: new Date(),
      lines: {
        create: [
          { orderNo: `SO-F-${ts}`, gender: "FEMALE", weightTier: "3.0两", count: 300 },
          { orderNo: `SO-M-${ts}`, gender: "MALE", weightTier: "4.0两", count: 300 },
        ],
      },
    },
  });

  const traceDirect = await resolveTraceQuery(obDirect.code);
  assert.ok(traceDirect, "应能查到出库单");
  const directFemale = traceDirect.lines.find((l) => l.gender === "FEMALE");
  assert.ok(directFemale, "必须包含母蟹行");

  console.log("\n▶ 无 specBatchMap 场景下母蟹溯源节点验证:");
  for (const node of directFemale.chain) {
    console.log(`  Step ${node.step} [${node.stageName}]: ${node.title} | ${node.subtitle}`);
  }

  // 1. 验证母蟹原料批次为李四
  const rawNode = directFemale.chain.find((n) => n.step === 1);
  assert.ok(rawNode?.title.includes("母蟹"), "原料节点必须为母蟹");
  assert.ok(rawNode?.subtitle.includes(farmerB.name), "原料节点养殖户必须为李四");

  // 2. 验证母蟹捆扎节点决不可出现公蟹捆扎班组
  const bundleNode = directFemale.chain.find((n) => n.step === 3);
  assert.ok(!bundleNode?.title.includes("公"), `母蟹捆扎节点严禁包含公蟹班组，实际为: ${bundleNode?.title}`);
  assert.ok(!bundleNode?.details.some((d) => d.label === "作业班组" && d.value.includes("公")), "母蟹捆扎详情严禁出现公蟹班组");

  // 3. 验证母蟹分拣节点决不可出现公蟹任务或公蟹规格
  const sortNode = directFemale.chain.find((n) => n.step === 4);
  assert.ok(!sortNode?.title.includes(sortTaskA.code), "母蟹分拣任务绝不可匹配公蟹任务 FJR-A");
  assert.ok(sortNode?.details.some((d) => d.label === "规格分级" && d.value.includes("母蟹")), "母蟹分拣规格必须标明母蟹");

  // 4. 验证母蟹预冷节点决不可沿用出库单的公蟹冷库批次
  const coldNode = directFemale.chain.find((n) => n.step === 5);
  assert.ok(!coldNode?.subtitle.includes(coldLogA.code), `母蟹预冷绝不可沿用公蟹入库单 ${coldLogA.code}，实际为: ${coldNode?.subtitle}`);

  // 5. 验证独立养殖户信息穿透
  assert.equal(directFemale.farmerInfo?.name, farmerB.name, "母蟹明细行的养殖户必须是李四");
  const directMale = traceDirect.lines.find((l) => l.gender === "MALE");
  assert.equal(directMale?.farmerInfo?.name, farmerA.name, "公蟹明细行的养殖户必须是张三");

  console.log("\n🎉 双规格（公+母）全链路规格严格隔离与防跨公母测试全部通过！");
}

runTest().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
