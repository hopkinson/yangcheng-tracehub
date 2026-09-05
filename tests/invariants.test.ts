import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

console.log("🦀 启动阳澄大闸蟹溯源系统 —— PRD V2.1 数量闭环与卡控规则自动化单元测试...\n");

// 1. 卡口一：入池额度校验
{
  console.log("▶ [Test 1] 养殖户年度额度与批次创建校验");
  const normal = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 20000,
    newBatchCount: 10000,
  });
  assert.equal(normal.valid, true, "累计30000 <= 60000 应该通过");

  const over = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 55000,
    newBatchCount: 10000,
  });
  assert.equal(over.valid, false, "累计65000 > 60000 应该被拦截");
  assert.equal(over.excess, 5000, "超出额度应为 5000");
  console.log("  ✔ 额度入池硬上限拦截测试通过");
}

// 2. 卡口一：暂养池空池入池与已有在养存量混池拦截
{
  console.log("▶ [Test 2] 暂养池空池入池与已有在养存量混池拦截");
  const emptyPool = Invariants.checkPoolSpec(
    { currentGender: null, currentWeightTier: null, activeCount: 0 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(emptyPool.valid, true);
  assert.equal(emptyPool.requiresBinding, true, "空池应允许入池并触发规格锁定");

  const occupiedPool = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(occupiedPool.valid, false, "已有在养存量时必须拦截，新批次只能选择空池");

  const diffGender = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "FEMALE", weightTier: "4.0两" }
  );
  assert.equal(diffGender.valid, false, "异公母在养池严禁入池");

  const diffWeight = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "3.0两" }
  );
  assert.equal(diffWeight.valid, false, "异规格在养池严禁入池");
  console.log("  ✔ 暂养池仅限空池入池与防混池拦截测试通过");
}

// 3. 卡口二：蟹扣领用余量动态卡控
{
  console.log("▶ [Test 3] 蟹扣可领余量与在池存活校验");
  const validClaim = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 5000,
    requestedCount: 3000,
  });
  assert.equal(validClaim.valid, true);

  const overPool = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 2000,
    requestedCount: 3000,
  });
  assert.equal(overPool.valid, false, "领扣数超过名下在池存活应被拦截");

  const overQuota = Invariants.checkTagClaim({
    farmerQuota: 12000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 5000,
    requestedCount: 3000,
  });
  assert.equal(overQuota.valid, false, "领扣数超过年度剩余额度应被拦截");
  console.log("  ✔ 蟹扣余量双重约束测试通过");
}

// 4. 卡口三：盘点损耗与 5% 红线告警
{
  console.log("▶ [Test 4] 实盘登记、负损耗拦截与 5% 告警红线");
  const negLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 1050,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(negLoss.valid, false, "实盘多于账面必须拦截，禁止负损耗");

  const normalLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 970,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(normalLoss.valid, true);
  assert.equal(normalLoss.isException, false, "损耗率 3% 不应触发异常标记");

  const highLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 920,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(highLoss.valid, true);
  assert.equal(highLoss.isException, true, "损耗率 8% 必须标记异常");
  console.log("  ✔ 实盘登记与损耗品控风控规则测试通过");
}

// 5. 卡口四：冷库规格可出库存出库校验 (PRD V2.1)
{
  console.log("▶ [Test 5] 冷库规格库存校验与不足拦截");
  // 正常出库
  const validColdOut = Invariants.checkColdStorageOutbound({
    availableCount: 1000,
    requestedCount: 600,
    spec: "3.5两",
    gender: "FEMALE",
  });
  assert.equal(validColdOut.valid, true);
  assert.equal(validColdOut.remaining, 400);

  // 库存不足拦截
  const overColdOut = Invariants.checkColdStorageOutbound({
    availableCount: 0,
    requestedCount: 800,
    spec: "3.5两",
    gender: "FEMALE",
  });
  assert.equal(overColdOut.valid, false);
  assert.ok(overColdOut.reason.includes("母蟹 3.5两 冷库可出库库存不足：需 800 只，现仅 0 只"));
  console.log("  ✔ 冷库规格库存校验与拦截提示测试通过");
}

// 6. 分拣称重与损耗自动计算 (PRD V2.1)
{
  console.log("▶ [Test 6] 分拣称重损耗计算与超5%红线");
  // 正常分拣 445 -> 438, 损耗 7 只 (1.57%)
  const normalSort = Invariants.calculateSortingLoss({
    inputCount: 445,
    qualifiedCount: 438,
  });
  assert.equal(normalSort.valid, true);
  assert.equal(normalSort.lossCount, 7);
  assert.equal(normalSort.lossRate, 1.57);
  assert.equal(normalSort.isException, false);

  // 损耗超标分拣 1000 -> 920, 损耗 80 只 (8%)
  const highLossSort = Invariants.calculateSortingLoss({
    inputCount: 1000,
    qualifiedCount: 920,
  });
  assert.equal(highLossSort.valid, true);
  assert.equal(highLossSort.lossCount, 80);
  assert.equal(highLossSort.lossRate, 8.0);
  assert.equal(highLossSort.isException, true);
  console.log("  ✔ 分拣称重损耗与5%告警测试通过");
}

// 7. 蟹卡规格型号正则智能拆分 (PRD V2.1)
{
  console.log("▶ [Test 7] 蟹卡规格型号多明细行正则自动拆分");
  const rawModel = "4.0母蟹X5只，5.0公蟹X5只";
  const parsed = Invariants.parseCrabCardSpec(rawModel);
  assert.equal(parsed.length, 2, "应拆分为 2 条明细行");
  assert.deepEqual(parsed[0], { gender: "FEMALE", weightTier: "4.0两", count: 5 });
  assert.deepEqual(parsed[1], { gender: "MALE", weightTier: "5.0两", count: 5 });

  const rawModel2 = "3.5母*4, 4.0公*4";
  const parsed2 = Invariants.parseCrabCardSpec(rawModel2);
  assert.equal(parsed2.length, 2);
  assert.deepEqual(parsed2[0], { gender: "FEMALE", weightTier: "3.5两", count: 4 });
  assert.deepEqual(parsed2[1], { gender: "MALE", weightTier: "4.0两", count: 4 });

  // 真实业务导出数据测试 (含 Unicode 乘号 ×、两、不同公母次序与 Excel 多列格式)
  const rawModel3 = "4.0母蟹×5只，5.0公蟹×5只";
  const parsed3 = Invariants.parseCrabCardSpec(rawModel3);
  assert.equal(parsed3.length, 2);
  assert.deepEqual(parsed3[0], { gender: "FEMALE", weightTier: "4.0两", count: 5 });
  assert.deepEqual(parsed3[1], { gender: "MALE", weightTier: "5.0两", count: 5 });

  const rawModel4 = "2.5母蟹×4只，3.5公蟹×4只";
  const parsed4 = Invariants.parseCrabCardSpec(rawModel4);
  assert.equal(parsed4.length, 2);
  assert.deepEqual(parsed4[0], { gender: "FEMALE", weightTier: "2.5两", count: 4 });
  assert.deepEqual(parsed4[1], { gender: "MALE", weightTier: "3.5两", count: 4 });

  // 测试批量粘贴解析
  const multiLineClipboard = `
251228204820877 2026/9/4   山姆紫金呈祥 4.0母蟹×5只，5.0公蟹×5只  8801159803379
251228204606054 2026/9/4   山姆898型   2.5母蟹×4只，3.5公蟹×4只  880089810391
`;
  const parsedBatch = Invariants.parseOrderImportText(multiLineClipboard, "CARD");
  assert.equal(parsedBatch.length, 4, "2 行订单应准确拆分出 4 条需求明细");
  assert.equal(parsedBatch[0].orderNo, "251228204820877");
  assert.equal(parsedBatch[0].weightTier, "4.0两");
  assert.equal(parsedBatch[0].count, 5);
  assert.equal(parsedBatch[1].weightTier, "5.0两");
  assert.equal(parsedBatch[1].count, 5);
  assert.equal(parsedBatch[2].orderNo, "251228204606054");
  assert.equal(parsedBatch[2].weightTier, "2.5两");
  assert.equal(parsedBatch[2].count, 4);
  assert.equal(parsedBatch[3].weightTier, "3.5两");
  assert.equal(parsedBatch[3].count, 4);

  console.log("  ✔ 蟹卡规格型号智能拆分与多列导入测试通过");
}

// 8. 蟹扣逐日轧平对账
{
  console.log("▶ [Test 8] 蟹扣日清日结轧平守恒");
  const balanced = Invariants.checkDailyBalance({
    claimedCount: 1000,
    boundCount: 800,
    returnedCount: 150,
    scrappedCount: 50,
  });
  assert.equal(balanced.isBalanced, true, "800 + 150 + 50 == 1000 应轧平");
  console.log("  ✔ 蟹扣日清日结对账守恒测试通过");
}

// 9. 订单批量导入智能解析与发货日期自适应防爆 (PRD V2.1)
{
  console.log("▶ [Test 9] 订单批量导入多列自适应解析与日期安全校验");
  const pasteText = `251228204820877\t2026/9/4\t山姆紫金呈祥\t4.0母蟹*5只，5.0公蟹*5只\t8801159803379
251228204606054\t2026/9/4\t山姆898型\t2.5母蟹*4只，3.5公蟹*4只\t880089810391`;

  const parsed = Invariants.parseOrderImportText(pasteText, "CARD");
  assert.equal(parsed.length, 4, "2 张蟹卡（各2规格）应被拆为 4 条需求明细");
  assert.equal(parsed[0].deliveryDate, "2026-09-04", "斜杠日期必须标准化为 YYYY-MM-DD");
  assert.equal(parsed[0].count, 5);
  assert.equal(parsed[0].weightTier, "4.0两");

  // 日期解析防爆
  const safeDate = Invariants.normalizeDate("山姆紫金呈祥");
  assert.ok(!isNaN(safeDate.getTime()), "非法日期格式应安全兜底为有效日期");

  // 回归测试：Excel 表头首行过滤与 9/8/26 日期格式解析 (避免首行表头被误判读且标题过长)
  const excelContentWithHeader =
    "提货单号\t提货规格型号\t要求发货日期\n" +
    "KK20260901001\t(4.0两公蟹×4只, 3.0两母蟹×4只)\t9/8/26";
  const parsedExcel = Invariants.parseOrderImportText(excelContentWithHeader, "CARD");
  assert.equal(parsedExcel.length, 2, "表头行必须被安全过滤，不应被判读为虚构订单行");
  assert.equal(parsedExcel[0].orderNo, "KK20260901001", "首条订单单号应为数据行单号，而非表头文字");
  assert.equal(parsedExcel[0].storeName, "蟹卡提货", "蟹卡渠道标题应简洁规范，严禁拼接表头或日期");
  assert.equal(parsedExcel[0].deliveryDate, "2026-09-08", "9/8/26 短格式日期必须被精确解析为 2026-09-08");
  assert.equal(parsedExcel[0].count + parsedExcel[1].count, 8, "总只数必须严格等于 8 只（4公+4母），严禁虚增 10 只");

  console.log("  ✔ 订单多列复制自适应拆解与表头首行安全过滤测试通过\n");
}

// 10. 分拣批次预冷入库余量卡控 (PRD V2.1)
{
  console.log("▶ [Test 10] 分拣批次合格品入库保鲜预冷余量与上限卡控");
  // 10.1 正常入库
  const validIntake = Invariants.checkColdIntake({
    qualifiedCount: 438,
    alreadyIntakeCount: 0,
    intakeCount: 400,
    taskStatus: "COMPLETED",
    taskCode: "FJR2026092101",
  });
  assert.equal(validIntake.valid, true);
  assert.equal(validIntake.remaining, 38);
  assert.equal(validIntake.availableCount, 438);

  // 10.2 刚好入完全部合格量
  const fullIntake = Invariants.checkColdIntake({
    qualifiedCount: 438,
    alreadyIntakeCount: 400,
    intakeCount: 38,
    taskStatus: "COMPLETED",
    taskCode: "FJR2026092101",
  });
  assert.equal(fullIntake.valid, true);
  assert.equal(fullIntake.remaining, 0);

  // 10.3 超额入库拦截
  const overIntake = Invariants.checkColdIntake({
    qualifiedCount: 438,
    alreadyIntakeCount: 400,
    intakeCount: 50,
    taskStatus: "COMPLETED",
    taskCode: "FJR2026092101",
  });
  assert.equal(overIntake.valid, false, "申请 50 只超出剩余 38 只必须被拦截");
  assert.equal(overIntake.availableCount, 38);
  assert.equal(overIntake.excess, 12);

  // 10.4 未完成分拣批次拦截
  const pendingTaskIntake = Invariants.checkColdIntake({
    qualifiedCount: 0,
    alreadyIntakeCount: 0,
    intakeCount: 100,
    taskStatus: "PENDING",
    taskCode: "FJR2026092102",
  });
  assert.equal(pendingTaskIntake.valid, false, "待分拣任务禁止直接入库");

  console.log("  ✔ 分拣批次保鲜入库余量与超额拦截测试通过\n");
}

// 11. 捆扎损耗计算与 5% 红线告警
{
  console.log("▶ [Test 11] 捆扎损耗计算与 5% 告警红线");
  const normalBundle = Invariants.calculateBundleLoss({
    inputCount: 1000,
    qualifiedCount: 980,
  });
  assert.equal(normalBundle.valid, true);
  assert.equal(normalBundle.lossCount, 20);
  assert.equal(normalBundle.lossRate, 2.0);
  assert.equal(normalBundle.isException, false);

  const overLossBundle = Invariants.calculateBundleLoss({
    inputCount: 1000,
    qualifiedCount: 940,
  });
  assert.equal(overLossBundle.valid, true);
  assert.equal(overLossBundle.lossCount, 60);
  assert.equal(overLossBundle.lossRate, 6.0);
  assert.equal(overLossBundle.isException, true, "损耗率 6% 超出 5% 阈值应判定为异常");

  const invalidBundle = Invariants.calculateBundleLoss({
    inputCount: 1000,
    qualifiedCount: 1050,
  });
  assert.equal(invalidBundle.valid, false, "合格只数大于投入只数必须拦截");

  console.log("  ✔ 捆扎损耗计算与 5% 告警红线测试通过\n");
}

console.log("🎉 全部 11 项 PRD V2.1 核心数学卡控规则测试 100% 通过！");

