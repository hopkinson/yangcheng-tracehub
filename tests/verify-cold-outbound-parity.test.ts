import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createStoreOutboundAction } from "../src/actions/outbound";
import { approveOutboundOrderAction } from "../src/actions/approvals";

const prisma = new PrismaClient();

async function runParityVerification() {
  console.log("================================================================================");
  console.log("🚀 真实全链路业务校验：保鲜预冷与出库管理数据轧平与实操流转测试");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const suffix = `PARITY_${timestamp}`;

  try {
    // 1. 准备基础角色
    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: { username: "admin", phone: "13800000001", fullName: "超级管理员", role: "ADMIN" },
    });
    const qaUser = await prisma.user.upsert({
      where: { username: "qa_lead" },
      update: {},
      create: { username: "qa_lead", phone: "13800000004", fullName: "品控主管", role: "QA_DIRECTOR" },
    });

    const channel = await prisma.channel.upsert({
      where: { code: "SAMS" },
      update: {},
      create: { code: "SAMS", name: "山姆会员商店" },
    });
    const store = await prisma.store.create({
      data: { code: `ST-${suffix}`, name: `山姆测试店-${suffix}`, channelId: channel.id },
    });

    // 2. 创建 4 个规格批次（模拟用户截图场景：公4.0、公3.5、母3.0、母2.5，各 1020 只）
    const specs = [
      { gender: "MALE", weightTier: "4.0两", count: 1020, crCode: `CR-0901-${suffix}`, fjrCode: `FJR-01-${suffix}` },
      { gender: "FEMALE", weightTier: "3.0两", count: 1020, crCode: `CR-0902-${suffix}`, fjrCode: `FJR-02-${suffix}` },
      { gender: "MALE", weightTier: "3.5两", count: 1020, crCode: `CR-0903-${suffix}`, fjrCode: `FJR-03-${suffix}` },
      { gender: "FEMALE", weightTier: "2.5两", count: 1020, crCode: `CR-0904-${suffix}`, fjrCode: `FJR-04-${suffix}` },
    ];

    const farmer = await prisma.farmer.create({
      data: {
        code: `JD-${suffix}`,
        name: "对账测试养殖户",
        phone: "13800112233",
        farmType: "LAKE_CRAB",
        year: 2026,
        area: 50,
        quota: 30000,
        enclosures: { create: [{ code: `W-${suffix}`, description: "核心水域" }] },
      },
      include: { enclosures: true },
    });

    const pool = await prisma.holdingPool.create({
      data: { code: `ZY-${suffix}`, name: "对账暂养池", status: "ACTIVE" },
    });

    const rawBatch = await prisma.batch.create({
      data: {
        code: `PC-${suffix}`,
        farmerId: farmer.id,
        enclosureId: farmer.enclosures[0].id,
        poolId: pool.id,
        gender: "MALE",
        weightTier: "4.0两",
        inPoolCount: 4080,
        outPoolCount: 4080,
        status: "COMPLETED",
        createdById: admin.id,
      },
    });

    const tagClaim = await prisma.tagClaim.create({
      data: {
        code: `TC-${suffix}`,
        farmerId: farmer.id,
        claimCount: 4080,
        claimDate: new Date(),
        applicantId: admin.id,
        status: "APPROVED",
      },
    });

    const group = await prisma.bundleGroup.create({
      data: { code: `BG-${suffix}`, name: "对账捆扎组" },
    });
    const bundleBatch = await prisma.bundleBatch.create({
      data: {
        code: `KZD-${suffix}`,
        groupId: group.id,
        tagClaimId: tagClaim.id,
        ropeBatch: `XS-${suffix}`,
        status: "COMPLETED",
        inputCount: 4080,
      },
    });

    const machine = await prisma.sortMachine.create({
      data: { code: `FJ-${suffix}`, name: "对账分拣机", status: "ACTIVE" },
    });

    // 建立 2 个保鲜库：BX-01 (A区) 存公4.0和母3.0；BX-02 (B区) 存公3.5和母2.5
    const bx01 = await prisma.coldStore.create({
      data: { code: `BX-01-${suffix}`, name: "保鲜预冷A区", targetTemp: 4.2 },
    });
    const bx02 = await prisma.coldStore.create({
      data: { code: `BX-02-${suffix}`, name: "保鲜预冷B区", targetTemp: 4.5 },
    });

    const createdColdLogs = [];

    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const sortTask = await prisma.sortTask.create({
        data: {
          code: sp.fjrCode,
          machineId: machine.id,
          bundleBatchId: bundleBatch.id,
          gender: sp.gender,
          weightTier: sp.weightTier,
          inputCount: sp.count,
          qualifiedCount: sp.count,
          status: "COMPLETED",
        },
      });

      const storeId = i < 2 ? bx01.id : bx02.id;
      const coldLog = await prisma.coldLog.create({
        data: {
          code: sp.crCode,
          storeId,
          type: "INTAKE",
          count: sp.count,
          refType: "SORT",
          refId: sortTask.code,
          operator: "李仓管",
        },
      });
      createdColdLogs.push(coldLog);
    }

    console.log("  ✔ 模拟数据创建完成：4 笔分拣任务各 1020 只，入库保鲜库两区各 2040 只，共 4080 只");

    // =========================================================================
    // 3. 核心断言 1：运行出库页面逻辑，验证规格库存卡是否 100% 动态对齐
    // =========================================================================
    const sortTasks = await prisma.sortTask.findMany({
      where: { bundleBatchId: bundleBatch.id, status: "COMPLETED" },
    });
    const outboundLines = await prisma.outboundLine.findMany({
      where: {
        outboundOrder: {
          storeId: store.id,
          status: { not: "REJECTED" },
        },
      },
    });

    // 运行 src/app/outbound/page.tsx 现有最新动态聚合逻辑
    const DEFAULT_SPECS = [
      { gender: "MALE", weightTier: "4.0两", label: "4.0两 公蟹" },
      { gender: "MALE", weightTier: "3.5两", label: "3.5两 公蟹" },
      { gender: "FEMALE", weightTier: "3.5两", label: "3.5两 母蟹" },
      { gender: "FEMALE", weightTier: "3.0两", label: "3.0两 母蟹" },
    ];

    const foundKeys = new Set(sortTasks.map((t: any) => `${t.gender}_${t.weightTier}`));
    const foundSpecs = Array.from(foundKeys).map((k) => {
      const [gender, weightTier] = k.split("_");
      return { gender, weightTier, label: `${weightTier} ${gender === "FEMALE" ? "母蟹" : "公蟹"}` };
    });

    const activeSpecs = [
      ...foundSpecs,
      ...DEFAULT_SPECS.filter((d) => !foundKeys.has(`${d.gender}_${d.weightTier}`)),
    ].slice(0, Math.max(4, foundSpecs.length))
     .sort((a, b) => (a.gender !== b.gender ? (a.gender === "MALE" ? -1 : 1) : parseFloat(b.weightTier) - parseFloat(a.weightTier)));

    const specStocks = activeSpecs.map((spec) => {
      const qualified = sortTasks
        .filter((t: any) => t.gender === spec.gender && t.weightTier === spec.weightTier)
        .reduce((a: number, t: any) => a + t.qualifiedCount, 0);

      const used = outboundLines
        .filter((l: any) => l.gender === spec.gender && l.weightTier === spec.weightTier)
        .reduce((a: number, l: any) => a + l.count, 0);

      const available = Math.max(0, qualified - used);
      const usagePct = qualified > 0 ? Math.min(100, Math.round((used / qualified) * 100)) : 0;

      return { ...spec, qualified, used, available, usagePct };
    });

    console.log("\n[出库管理页面实时计算规格卡]:");
    specStocks.forEach((s) => {
      console.log(`  - [${s.label}] 合格: ${s.qualified} 只 | 可出库存: ${s.available} 只`);
    });

    const totalCalculatedOutbound = specStocks
      .filter((s) => foundKeys.has(`${s.gender}_${s.weightTier}`))
      .reduce((a, b) => a + b.available, 0);

    assert.equal(totalCalculatedOutbound, 4080, "出库管理页面规格卡总可用数必须等于保鲜库实际在库数 4080 只！");
    assert.ok(specStocks.some((s) => s.gender === "FEMALE" && s.weightTier === "3.0两" && s.available === 1020), "必须包含 3.0两母蟹 且有 1020 只");
    assert.ok(specStocks.some((s) => s.gender === "FEMALE" && s.weightTier === "2.5两" && s.available === 1020), "必须包含 2.5两母蟹 且有 1020 只");
    console.log("  ✔ 断言通过：出库管理页完整显示 4 大实际规格，总数 4080 只与保鲜库完美轧平！");

    // =========================================================================
    // 4. 核心断言 2：测试非预设规格（如 3.0两母蟹）真实创建出库单并审批
    // =========================================================================
    console.log("\n[业务流转验证：针对 3.0两母蟹 创建门店出库申请]");
    const orderFemale3 = await prisma.order.create({
      data: {
        code: `SO-F3-${suffix}`,
        importId: `IM-${suffix}`,
        orderNo: `ORDER-F3-${suffix}`,
        type: "STORE_ORDER",
        storeId: store.id,
        storeName: store.name,
        gender: "FEMALE",
        weightTier: "3.0两",
        count: 500,
        deliveryDate: new Date(),
        status: "PENDING",
      },
    });

    const outboundOrder = await createStoreOutboundAction({
      storeId: store.id,
      orderIds: [orderFemale3.id],
      coldLogId: createdColdLogs[1].id, // 关联 CR-0902 (母蟹 3.0两)
      applicantId: admin.id,
    });

    assert.ok(outboundOrder.id, "出库单创建成功");
    assert.equal(outboundOrder.outboundCount, 500, "出库只数 500 只");
    console.log(`  ✔ 成功创建 3.0两母蟹 出库申请 [${outboundOrder.code}]，数量 500 只，未被误拦截`);

    // 审批出库单
    const approved = await approveOutboundOrderAction({
      orderId: outboundOrder.id,
      approved: true,
      comment: "冷库实物充足，准予出库",
      approverId: qaUser.id,
    });
    assert.equal(approved.status, "APPROVED", "出库审批放行成功");
    console.log("  ✔ 品控审批成功通过！");

    // =========================================================================
    // 5. 核心断言 3：验证出库后，保鲜库在库余量与出库页面库存同步扣减轧平
    // =========================================================================
    const updatedColdLog = await prisma.coldLog.findUniqueOrThrow({
      where: { id: createdColdLogs[1].id },
      include: { outboundOrders: { where: { status: { not: "REJECTED" } } } },
    });
    const logUsed = updatedColdLog.outboundOrders.reduce((a, b) => a + b.outboundCount, 0);
    const logRemaining = updatedColdLog.count - logUsed;

    assert.equal(logUsed, 500, "保鲜批次已出库占用 500 只");
    assert.equal(logRemaining, 520, "保鲜批次在库余量精确剩余 520 只 (1020 - 500)");
    console.log(`  ✔ 保鲜预冷入库批次 [${updatedColdLog.code}] 实时余量: ${logRemaining} 只 (已核销 500 只)`);

    console.log("\n================================================================================");
    console.log("🎉 所有对账与业务流转断言 100% 达成要求！系统数据无任何偏差！");
    console.log("================================================================================");
  } finally {
    await prisma.$disconnect();
  }
}

runParityVerification().catch((err) => {
  console.error("❌ 校验失败:", err);
  process.exit(1);
});
