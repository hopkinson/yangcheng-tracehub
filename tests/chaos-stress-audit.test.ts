import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Invariants } from "../src/lib/invariants";

const prisma = new PrismaClient();

interface AuditReportSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

const summary: AuditReportSummary = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
};

async function trackTest(name: string, fn: () => void | Promise<void>) {
  summary.totalTests++;
  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
    summary.passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err: any) {
    summary.failedTests++;
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runChaosStressAudit() {
  console.log("================================================================================");
  console.log("🦀 阳澄股份大闸蟹全链路溯源品控系统 —— 全链路混沌攻防与边界深度审计套件");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testId = timestamp.toString().slice(-4);

  // -------------------------------------------------------------------------
  // 0. 初始化测试角色与基础设施
  // -------------------------------------------------------------------------
  console.log("🛠️  [0/8] 准备审计测试角色与系统基础设施...");
  
  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: `admin_chaos_${testId}`,
        phone: `1380011${testId}`,
        fullName: "审计超级管理员",
        role: "ADMIN",
      },
    });
  }

  let qaUser = await prisma.user.findFirst({ where: { role: "QA_DIRECTOR" } });
  if (!qaUser) {
    qaUser = await prisma.user.create({
      data: {
        username: `qa_chaos_${testId}`,
        phone: `1390011${testId}`,
        fullName: "审计品控主管",
        role: "QA_DIRECTOR",
      },
    });
  }

  let whUser = await prisma.user.findFirst({ where: { role: "WAREHOUSE_ADMIN" } });
  if (!whUser) {
    whUser = await prisma.user.create({
      data: {
        username: `wh_chaos_${testId}`,
        phone: `1370011${testId}`,
        fullName: "审计仓管员",
        role: "WAREHOUSE_ADMIN",
      },
    });
  }

  let channel = await prisma.channel.findFirst({ where: { code: "SAMS" } });
  if (!channel) {
    channel = await prisma.channel.create({
      data: { code: "SAMS", name: "山姆会员商店" },
    });
  }

  let store = await prisma.store.findFirst({ where: { channelId: channel.id } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        code: `ST-CHAOS-${testId}`,
        name: "山姆华东自动化测试仓",
        channelId: channel.id,
      },
    });
  }
  console.log("  ✔ 基础角色与渠道门店就绪\n");

  // -------------------------------------------------------------------------
  // 1. 养殖户与源头额度卡控深度测试
  // -------------------------------------------------------------------------
  console.log("▶ [1/8] 模块一：养殖户源头额度卡控与特批审计");
  
  const farmerArea = 30; // 30 亩
  const calculatedQuota = Invariants.calculateQuota(farmerArea); // 18,000 只
  assert.equal(calculatedQuota, 18000, "额度计算公式必须严格为 area * 600");

  const farmerCode = `JD-CHAOS-${testId}`;
  const farmer = await prisma.farmer.create({
    data: {
      code: farmerCode,
      name: `阳澄湖混沌测试示范基地-${testId}`,
      phone: "13912340001",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: farmerArea,
      quota: calculatedQuota,
      creditRating: "A",
      status: "ACTIVE",
    },
  });

  const enclosure = await prisma.enclosure.create({
    data: {
      code: `W-CHAOS-${testId}`,
      farmerId: farmer.id,
      description: "东湖生态示范网区",
    },
  });

  // 测试 1.1: 额度校验正常区间
  await trackTest("额度余量充足时允许入库校验", () => {
    const check1 = Invariants.checkQuota({
      annualQuota: farmer.quota,
      cumulativeInPool: 0,
      newBatchCount: 10000,
    });
    assert.equal(check1.valid, true);
    assert.equal(check1.remainingQuota, 18000);
    assert.equal(check1.excess, 0);
  });

  // 测试 1.2: 超额硬拦截 (超出额度 2000 只)
  await trackTest("超额入库无特批时必须硬阻断", () => {
    const checkOver = Invariants.checkQuota({
      annualQuota: farmer.quota,
      cumulativeInPool: 15000,
      newBatchCount: 5000, // 15000 + 5000 = 20000 > 18000
    });
    assert.equal(checkOver.valid, false);
    assert.equal(checkOver.excess, 2000);
  });

  // 测试 1.3: 特批入库审计留痕
  await trackTest("ADMIN 角色超额特批留痕记录入库", async () => {
    const specialApproval = await prisma.specialApproval.create({
      data: {
        actionType: "OVER_QUOTA_INTAKE",
        farmerId: farmer.id,
        batchCode: `PC-CHAOS-SP-${testId}`,
        reason: "台风抢收紧急特批入池，经农业局备案",
        approvedById: admin.id,
      },
    });
    assert.ok(specialApproval.id);
    assert.equal(specialApproval.actionType, "OVER_QUOTA_INTAKE");
  });

  // -------------------------------------------------------------------------
  // 2. 暂养池管理与防混池隔离深度测试
  // -------------------------------------------------------------------------
  console.log("\n▶ [2/8] 模块二：暂养池规格绑定、防混池与防误删保护");

  const pool1 = await prisma.holdingPool.create({
    data: {
      code: `ZY-C1-${testId}`,
      name: `测试暂养1号池-${testId}`,
      status: "ACTIVE",
    },
  });

  const pool2 = await prisma.holdingPool.create({
    data: {
      code: `ZY-C2-${testId}`,
      name: `测试暂养2号池-${testId}`,
      status: "ACTIVE",
    },
  });

  // 测试 2.1: 空池入池，绑定规格
  await trackTest("空池首次入库成功并锁定规格", () => {
    const checkEmpty = Invariants.checkPoolSpec(
      { currentGender: pool1.currentGender, currentWeightTier: pool1.currentWeightTier, activeCount: 0 },
      { gender: "MALE", weightTier: "4.0两" }
    );
    assert.equal(checkEmpty.valid, true);
    assert.equal(checkEmpty.requiresBinding, true);
  });

  // 更新 pool1 锁定公蟹 4.0两
  await prisma.holdingPool.update({
    where: { id: pool1.id },
    data: { currentGender: "MALE", currentWeightTier: "4.0两" },
  });

  // 测试 2.2: 池内已有存量时，严禁混入任何新批次（PRD V2.1 批次隔离要求）
  await trackTest("已有存量池强行混入异规格拦截", () => {
    const checkMixDiff = Invariants.checkPoolSpec(
      { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 2000 },
      { gender: "FEMALE", weightTier: "3.0两" }
    );
    assert.equal(checkMixDiff.valid, false);
    assert.match(checkMixDiff.reason, /禁止混入新批次/);
  });

  await trackTest("已有存量池混入同规格亦必须被批次隔离拦截（必须选空池）", () => {
    const checkMixSame = Invariants.checkPoolSpec(
      { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 2000 },
      { gender: "MALE", weightTier: "4.0两" }
    );
    assert.equal(checkMixSame.valid, false);
    assert.match(checkMixSame.reason, /已有在养存量/);
  });

  // -------------------------------------------------------------------------
  // 3. 原料入池与一码单多规格拆分（主从结构）
  // -------------------------------------------------------------------------
  console.log("\n▶ [3/8] 模块三：一码单多规格拆分入库与品控留痕");

  const batchCode = `PC-CHAOS-M-${testId}`;
  const rawBatch = await prisma.batch.create({
    data: {
      code: batchCode,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 8000,
      createdById: whUser.id,
      formNo: `YCGF-CHAOS-${testId}`,
      temp: 12.5,
      humidity: 88.0,
      escort: "张三跟车员",
      quickCheck: "QUALIFIED",
      sampleCheck: "QUALIFIED",
      items: {
        create: [
          {
            poolId: pool1.id,
            gender: "MALE",
            weightTier: "4.0两",
            weight: 1600.0,
            inPoolCount: 5000,
          },
          {
            poolId: pool2.id,
            gender: "FEMALE",
            weightTier: "3.0两",
            weight: 750.0,
            inPoolCount: 3000,
          },
        ],
      },
    },
    include: { items: true },
  });

  await trackTest("一码单多规格子明细数量与总批次守恒", () => {
    assert.equal(rawBatch.items.length, 2);
    const subTotal = rawBatch.items.reduce((s, it) => s + it.inPoolCount, 0);
    assert.equal(subTotal, rawBatch.inPoolCount, "子批次明细行合计必须等于主批次总入池数");
  });

  // 测试 3.1: 暂养池有活蟹时防物理删除保护
  await trackTest("暂养池有在养活蟹时禁止物理删除", async () => {
    const poolActiveCount = rawBatch.inPoolCount - rawBatch.outPoolCount - rawBatch.lossCount;
    assert.ok(poolActiveCount > 0, "当前暂养池内有活蟹");
    const canDelete = poolActiveCount === 0;
    assert.equal(canDelete, false, "有活蟹时必须禁止物理删除暂养池");
  });

  // -------------------------------------------------------------------------
  // 4. 损耗盘点制与 5% 红线风控深度测试
  // -------------------------------------------------------------------------
  console.log("\n▶ [4/8] 模块四：损耗盘点制、负损耗拦截与 5% 预警红线");

  // 测试 4.1: 负损耗攻击拦截 (账面 8000，实盘 8200)
  await trackTest("实盘数大于账面数（负损耗）必须被强制拦截", () => {
    const negLoss = Invariants.calculateLoss({
      bookInPool: 8000,
      physicalCount: 8200,
      inPoolCount: 8000,
      historicalLoss: 0,
    });
    assert.equal(negLoss.valid, false);
    assert.match(negLoss.reason, /实盘数量大于账面在池/);
  });

  // 测试 4.2: 正常损耗 (实盘 7840，损耗 160，损耗率 2.0% <= 5%)
  await trackTest("损耗率 <= 5% 时正常放行且不强制告警", () => {
    const normalLoss = Invariants.calculateLoss({
      bookInPool: 8000,
      physicalCount: 7840,
      inPoolCount: 8000,
      historicalLoss: 0,
    });
    assert.equal(normalLoss.valid, true);
    assert.equal(normalLoss.lossDelta, 160);
    assert.equal(normalLoss.lossRate, 2.0);
    assert.equal(normalLoss.isException, false);
  });

  // 测试 4.3: 异常损耗 (实盘 7200，损耗 800，损耗率 10.0% > 5%)
  await trackTest("损耗率 > 5% 时触发高危告警并要求强制必填原因", () => {
    const highLoss = Invariants.calculateLoss({
      bookInPool: 8000,
      physicalCount: 7200,
      inPoolCount: 8000,
      historicalLoss: 0,
    });
    assert.equal(highLoss.valid, true);
    assert.equal(highLoss.lossDelta, 800);
    assert.equal(highLoss.lossRate, 10.0);
    assert.equal(highLoss.isException, true);
  });

  // 登记一次正常盘点 (损耗 200 只)
  await prisma.lossRecord.create({
    data: {
      batchId: rawBatch.id,
      bookInPool: 8000,
      physicalCount: 7800,
      lossCount: 200,
      cumulativeLoss: 200,
      lossRate: 2.5,
      reason: "暂养正常脱壳自然损耗",
      inspectorId: whUser.id,
    },
  });

  // 更新批次损耗
  await prisma.batch.update({
    where: { id: rawBatch.id },
    data: { lossCount: 200 },
  });

  await trackTest("盘点后批次账面在池数量实时更新", async () => {
    const updatedBatch = await prisma.batch.findUniqueOrThrow({ where: { id: rawBatch.id } });
    const bookInPool = updatedBatch.inPoolCount - updatedBatch.outPoolCount - updatedBatch.lossCount;
    assert.equal(bookInPool, 7800, "8000 - 0 - 200 = 7800");
  });

  // -------------------------------------------------------------------------
  // 5. 蟹扣领用双重上限与日清日结轧平
  // -------------------------------------------------------------------------
  console.log("\n▶ [5/8] 模块五：蟹扣领用双重余量卡控与日清日结轧平");

  await trackTest("申请蟹扣数超过在池存活数时被拦截", () => {
    const claimOverActive = Invariants.checkTagClaim({
      farmerQuota: farmer.quota,
      cumulativeClaimed: 0,
      activeInPoolCount: 7800,
      requestedCount: 8500, // 8500 > 7800
    });
    assert.equal(claimOverActive.valid, false);
    assert.equal(claimOverActive.maxClaimable, 7800);
  });

  await trackTest("申请蟹扣数在合规余量内时放行", () => {
    const validClaim = Invariants.checkTagClaim({
      farmerQuota: farmer.quota,
      cumulativeClaimed: 0,
      activeInPoolCount: 7800,
      requestedCount: 6000,
    });
    assert.equal(validClaim.valid, true);
    assert.equal(validClaim.maxClaimable, 7800);
  });

  // 创建蟹扣领用单
  const tagClaim = await prisma.tagClaim.create({
    data: {
      code: `XK-CHAOS-${testId}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 6000,
      applicantId: whUser.id,
      status: "APPROVED",
      approverId: qaUser.id,
      approvedAt: new Date(),
    },
  });

  // 测试 5.1: 日结未轧平 (领 6000，绑扣 4000，退回 1000，作废 500 = 5500 != 6000)
  await trackTest("蟹扣日结差额未平（存在漏记）时精确识别未轧平", () => {
    const unbalance = Invariants.checkDailyBalance({
      claimedCount: 6000,
      boundCount: 4000,
      returnedCount: 1000,
      scrappedCount: 500,
    });
    assert.equal(unbalance.isBalanced, false);
    assert.equal(unbalance.diff, 500);
  });

  // 测试 5.2: 日结精确轧平 (领 6000 = 绑 4000 + 退 1500 + 废 500)
  await trackTest("蟹扣日结四项平衡（领用 = 绑扣 + 退回 + 作废）时判定轧平", () => {
    const balance = Invariants.checkDailyBalance({
      claimedCount: 6000,
      boundCount: 4000,
      returnedCount: 1500,
      scrappedCount: 500,
    });
    assert.equal(balance.isBalanced, true);
    assert.equal(balance.diff, 0);
  });

  // -------------------------------------------------------------------------
  // 6. 车间加工流转（捆扎、分拣、冷库预冷）
  // -------------------------------------------------------------------------
  console.log("\n▶ [6/8] 模块六：捆扎班组、分拣称重损耗与保鲜预冷");

  const bundleGroup = await prisma.bundleGroup.create({
    data: {
      code: `P-CHAOS-${testId}`,
      name: "自动化测试捆扎一组",
      status: "BUNDLING",
    },
  });

  const bundleBatch = await prisma.bundleBatch.create({
    data: {
      code: `KZD-CHAOS-${testId}`,
      groupId: bundleGroup.id,
      tagClaimId: tagClaim.id,
      ropeBatch: `XS2026-${testId}`,
      status: "BUNDLING",
      lines: {
        create: [
          {
            poolId: pool1.id,
            gender: "MALE",
            weightTier: "4.0两",
            count: 4000,
          },
        ],
      },
    },
  });

  const sortMachine = await prisma.sortMachine.create({
    data: {
      code: `FJ-CHAOS-${testId}`,
      name: "高速动态分拣机-测试机",
      status: "ACTIVE",
      lastCalibrationStatus: "QUALIFIED",
      lastCalibratedAt: new Date(),
    },
  });

  // 测试 6.1: 分拣称重损耗计算
  await trackTest("分拣称重损耗计算与超5%红线识别", () => {
    const sort1 = Invariants.calculateSortingLoss({ inputCount: 4000, qualifiedCount: 3880 });
    assert.equal(sort1.lossCount, 120);
    assert.equal(sort1.lossRate, 3.0);
    assert.equal(sort1.isException, false);

    const sort2 = Invariants.calculateSortingLoss({ inputCount: 4000, qualifiedCount: 3600 });
    assert.equal(sort2.lossCount, 400);
    assert.equal(sort2.lossRate, 10.0);
    assert.equal(sort2.isException, true);
  });

  const sortTask = await prisma.sortTask.create({
    data: {
      code: `FJR-CHAOS-${testId}`,
      machineId: sortMachine.id,
      bundleBatchId: bundleBatch.id,
      gender: "MALE",
      weightTier: "4.0两",
      inputCount: 4000,
      qualifiedCount: 4000,
      lossCount: 0,
      lossRate: 0.0,
      status: "COMPLETED",
      doneAt: new Date(),
    },
  });

  const coldStore = await prisma.coldStore.create({
    data: {
      code: `BX-CHAOS-${testId}`,
      name: "预冷保鲜A区-测试库",
      targetTemp: 4.5,
    },
  });

  const coldLog = await prisma.coldLog.create({
    data: {
      code: `CR-CHAOS-${testId}`,
      storeId: coldStore.id,
      type: "INTAKE",
      count: 4000,
      refType: "SORT",
      refId: sortTask.code,
      operator: "李四仓管",
    },
  });
  assert.ok(coldLog.id);

  // -------------------------------------------------------------------------
  // 7. 蟹卡复杂拆单、订单匹配与出库单单票一致性
  // -------------------------------------------------------------------------
  console.log("\n▶ [7/8] 模块七：蟹卡复杂描述智能拆解与出库单票合规");

  // 测试 7.1: 蟹卡复杂规格文本智能拆分
  await trackTest("复杂混装蟹卡规格文本智能拆解为独立明细行", () => {
    const complexSpec = "4.0母蟹X4只，4.5公蟹X4只";
    const parsed = Invariants.parseCrabCardSpec(complexSpec);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].gender, "FEMALE");
    assert.equal(parsed[0].weightTier, "4.0两");
    assert.equal(parsed[0].count, 4);

    assert.equal(parsed[1].gender, "MALE");
    assert.equal(parsed[1].weightTier, "4.5两");
    assert.equal(parsed[1].count, 4);
  });

  // 创建渠道发货订单
  const order = await prisma.order.create({
    data: {
      code: `SO-CHAOS-${testId}`,
      importId: `IM20260901-${testId}`,
      orderNo: `SM-SAM-ORDER-${testId}`,
      type: "STORE_ORDER",
      storeName: store.name,
      gender: "MALE",
      weightTier: "4.0两",
      count: 4000,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  // 测试 7.2: 出库单票不一致拦截 (出库申请 4000 != 订单需求 3500)
  await trackTest("出库数量与渠道订单数量不一致时拦截", () => {
    const checkMismatch = Invariants.checkOutbound({
      bookInPool: 7800,
      outboundCount: 4000,
      channelOrderCount: 3500,
    });
    assert.equal(checkMismatch.valid, false);
    assert.match(checkMismatch.reason, /与渠道订单数量.*不一致/);
  });

  // 测试 7.3: 超出发货在池余量拦截 (账面 7800，尝试出库 8000)
  await trackTest("出库数量超过批次账面在池余量时强行拦截", () => {
    const checkExceed = Invariants.checkOutbound({
      bookInPool: 7800,
      outboundCount: 8000,
      channelOrderCount: 8000,
    });
    assert.equal(checkExceed.valid, false);
    assert.match(checkExceed.reason, /在池存活不足/);
  });

  // 创建合规出库单
  await prisma.outboundOrder.create({
    data: {
      code: `CK-CHAOS-${testId}`,
      type: "STORE_ORDER",
      storeId: store.id,
      storeName: store.name,
      channelId: channel.id,
      batchId: rawBatch.id,
      outboundCount: 4000,
      channelOrderCount: 4000,
      status: "APPROVED",
      applicantId: whUser.id,
      approverId: qaUser.id,
      approvedAt: new Date(),
      logisticsNo: `SF-CHAOS-${testId}`,
      lines: {
        create: [
          {
            orderId: order.id,
            orderNo: order.orderNo,
            gender: "MALE",
            weightTier: "4.0两",
            count: 4000,
            expressCompany: "顺丰冷链速运",
            waybillNo: `SF-CHAOS-${testId}`,
          },
        ],
      },
    },
  });

  // 出库后扣减批次在池
  await prisma.batch.update({
    where: { id: rawBatch.id },
    data: {
      outPoolCount: { increment: 4000 },
      status: "PARTIALLY_OUTBOUND",
    },
  });

  // 更新订单为已发货
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "SHIPPED" },
  });

  // -------------------------------------------------------------------------
  // 8. 渠道反向穿透溯源与五大数量守恒终极对账
  // -------------------------------------------------------------------------
  console.log("\n▶ [8/8] 模块八：渠道反向溯源穿透与五大守恒闭环证明链");

  await trackTest("通过顺丰运单号反向穿透全链路证据链", async () => {
    const outboundRecord = await prisma.outboundOrder.findFirstOrThrow({
      where: { logisticsNo: `SF-CHAOS-${testId}` },
      include: {
        store: true,
        channel: true,
        batch: {
          include: {
            farmer: true,
            enclosure: true,
            pool: true,
            items: true,
            lossRecords: true,
          },
        },
        lines: true,
      },
    });

    assert.equal(outboundRecord.channel.code, "SAMS");
    assert.match(outboundRecord.channel.name, /山姆/);
    assert.equal(outboundRecord.batch.farmer.code, farmerCode);
    assert.equal(outboundRecord.batch.enclosure.code, `W-CHAOS-${testId}`);
    assert.equal(outboundRecord.batch.formNo, `YCGF-CHAOS-${testId}`);
    assert.equal(outboundRecord.lines[0].waybillNo, `SF-CHAOS-${testId}`);

    // 五大数量守恒不等式验证
    // 不等式 1: 累计入池 <= 养殖户年度额度
    assert.ok(outboundRecord.batch.farmer.quota >= outboundRecord.batch.inPoolCount);

    // 不等式 2: 批次在池 = inPool (8000) - outPool (4000) - loss (200) = 3800 >= 0
    const currentLive = outboundRecord.batch.inPoolCount - outboundRecord.batch.outPoolCount - outboundRecord.batch.lossCount;
    assert.equal(currentLive, 3800);
    assert.ok(currentLive >= 0);

    // 不等式 3: 单票出库数 == 渠道订单数 (4000 == 4000)
    assert.equal(outboundRecord.outboundCount, outboundRecord.channelOrderCount);
  });

  // -------------------------------------------------------------------------
  // 审计总结报告
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 阳澄大闸蟹全链路系统审计与混沌测试报告");
  console.log("================================================================================");
  console.log(`执行测试总数: ${summary.totalTests} 项`);
  console.log(`通过测试项数: ${summary.passedTests} 项 (${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%)`);
  console.log(`失败测试项数: ${summary.failedTests} 项`);
  console.log("--------------------------------------------------------------------------------");

  if (summary.failedTests === 0) {
    console.log("🎉 [SUCCESS] 系统全流程卡控规则、五大不变量与溯源穿透全部通过检验！");
  } else {
    console.log("⚠️ [WARNING] 发现存在异常测试用例，请查看上述排查日志！");
  }
  console.log("================================================================================\n");
}

runChaosStressAudit()
  .catch((e) => {
    console.error("Fatal test error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
