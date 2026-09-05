import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

console.log("🦀 启动订单导入智能解析与发货日期防爆测试...\n");

// 1. 用户截图中的实际粘贴内容（Excel 复制：Tab 分隔 或 空格分隔）
{
  console.log("▶ [Test 1] 真实 Excel 粘贴内容智能解析 (Tab/空格分隔多列)");
  const pasteText = `251228204820877\t2026/9/4\t山姆紫金呈祥\t4.0母蟹×5只，5.0公蟹×5只\t8801159803379
251228204606054\t2026/9/4\t山姆898型\t2.5母蟹×4只，3.5公蟹×4只\t880089810391`;

  const parsed = Invariants.parseOrderImportText(pasteText, "CARD");
  assert.equal(parsed.length, 4, "2 张蟹卡（每张 2 种规格）应被正确拆分为 4 条发货明细");

  // 校验行 1
  assert.equal(parsed[0].orderNo, "251228204820877");
  assert.equal(parsed[0].deliveryDate, "2026-09-04", "日期 '2026/9/4' 应标准化为 '2026-09-04'");
  assert.equal(parsed[0].gender, "FEMALE");
  assert.equal(parsed[0].weightTier, "4.0两");
  assert.equal(parsed[0].count, 5);
  assert.equal(parsed[0].storeName, "蟹卡提货 (山姆紫金呈祥)");
  assert.equal(parsed[0].isPreSplit, true);

  // 校验行 2
  assert.equal(parsed[1].orderNo, "251228204820877");
  assert.equal(parsed[1].deliveryDate, "2026-09-04");
  assert.equal(parsed[1].gender, "MALE");
  assert.equal(parsed[1].weightTier, "5.0两");
  assert.equal(parsed[1].count, 5);

  // 校验行 3
  assert.equal(parsed[2].orderNo, "251228204606054");
  assert.equal(parsed[2].deliveryDate, "2026-09-04");
  assert.equal(parsed[2].gender, "FEMALE");
  assert.equal(parsed[2].weightTier, "2.5两");
  assert.equal(parsed[2].count, 4);
  assert.equal(parsed[2].storeName, "蟹卡提货 (山姆898型)");

  // 校验行 4
  assert.equal(parsed[3].orderNo, "251228204606054");
  assert.equal(parsed[3].deliveryDate, "2026-09-04");
  assert.equal(parsed[3].gender, "MALE");
  assert.equal(parsed[3].weightTier, "3.5两");
  assert.equal(parsed[3].count, 4);

  // 校验生成的 deliveryDate 能被合法转为 Date，绝不出现 Invalid Date
  const dateObj = Invariants.normalizeDate(parsed[0].deliveryDate);
  assert.ok(!isNaN(dateObj.getTime()), "deliveryDate 必须是合法的 Date 对象");
  console.log("  ✔ Excel 粘贴解析与规格自动拆分测试通过");
}

// 2. 传统 3 列占位符格式兼任测试
{
  console.log("▶ [Test 2] 传统 3 列占位符格式兼任测试");
  const text = "KK20260921102 4.0母蟹X5只，5.0公蟹X5只 2026-09-22";
  const parsed = Invariants.parseOrderImportText(text, "CARD");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].orderNo, "KK20260921102");
  assert.equal(parsed[0].deliveryDate, "2026-09-22");
  assert.equal(parsed[0].gender, "FEMALE");
  assert.equal(parsed[0].weightTier, "4.0两");
  assert.equal(parsed[0].count, 5);
  console.log("  ✔ 传统 3 列格式兼容性测试通过");
}

// 3. 门店订单导入解析测试
{
  console.log("▶ [Test 3] 门店订单导入解析测试");
  const storeText = `SO20260921008\t山姆(深圳店)\t公\t4.0两\t1500\t2026/9/4
SO20260921009\t山姆(上海店)\t母\t3.5两\t800\t2026-09-22`;

  const parsed = Invariants.parseOrderImportText(storeText, "STORE");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].orderNo, "SO20260921008");
  assert.equal(parsed[0].deliveryDate, "2026-09-04");
  assert.equal(parsed[0].gender, "MALE");
  assert.equal(parsed[0].count, 1500);

  assert.equal(parsed[1].orderNo, "SO20260921009");
  assert.equal(parsed[1].deliveryDate, "2026-09-22");
  assert.equal(parsed[1].gender, "FEMALE");
  assert.equal(parsed[1].count, 800);
  console.log("  ✔ 门店订单导入解析测试通过");
}

// 4. 日期容错防爆测试（彻底杜绝 Prisma Invalid Date）
{
  console.log("▶ [Test 4] 日期多格式自适应与异常输入防爆测试");
  assert.equal(Invariants.normalizeDateStr("2026/9/4"), "2026-09-04");
  assert.equal(Invariants.normalizeDateStr("2026-9-4"), "2026-09-04");
  assert.equal(Invariants.normalizeDateStr("2026.09.04"), "2026-09-04");
  assert.equal(Invariants.normalizeDateStr("2026年9月4日"), "2026-09-04");

  // 乱码输入不崩溃且返回有效 Date
  const fallbackDate = Invariants.normalizeDate("山姆紫金呈祥");
  assert.ok(!isNaN(fallbackDate.getTime()), "非法文本应安全兜底为有效日期，杜绝 Prisma 抛异常");
  console.log("  ✔ 日期防爆容错测试通过\n");
}

// 5. 用户实际报障场景回归测试 (8 位纯数字发货日期 YYYYMMDD 与 Unicode 乘号 × 规格智能拆解)
{
  console.log("▶ [Test 5] 用户实际报障场景回归测试 (YYYYMMDD + 双规格拆分 + 杜绝 Invalid Date)");
  const userText = `251228204820877  4.0母蟹×5只，5.0公蟹×5只  20250101
251228204606054  2.5母蟹×4只，3.5公蟹×4只  20250101`;

  const parsed = Invariants.parseOrderImportText(userText, "CARD");
  assert.equal(parsed.length, 4, "2 张双规格卡应准确拆分成 4 条发货明细");

  // 校验订单 1
  assert.equal(parsed[0].orderNo, "251228204820877");
  assert.equal(parsed[0].gender, "FEMALE");
  assert.equal(parsed[0].weightTier, "4.0两");
  assert.equal(parsed[0].count, 5);
  assert.equal(parsed[0].deliveryDate, "2025-01-01", "8位纯数字 20250101 必须正确解析为 2025-01-01");
  assert.equal(parsed[0].storeName, "蟹卡提货", "不应将日期误作为门店/型号名");

  assert.equal(parsed[1].orderNo, "251228204820877");
  assert.equal(parsed[1].gender, "MALE");
  assert.equal(parsed[1].weightTier, "5.0两");
  assert.equal(parsed[1].count, 5);
  assert.equal(parsed[1].deliveryDate, "2025-01-01");

  // 校验订单 2
  assert.equal(parsed[2].orderNo, "251228204606054");
  assert.equal(parsed[2].gender, "FEMALE");
  assert.equal(parsed[2].weightTier, "2.5两");
  assert.equal(parsed[2].count, 4);
  assert.equal(parsed[2].deliveryDate, "2025-01-01");

  assert.equal(parsed[3].orderNo, "251228204606054");
  assert.equal(parsed[3].gender, "MALE");
  assert.equal(parsed[3].weightTier, "3.5两");
  assert.equal(parsed[3].count, 4);
  assert.equal(parsed[3].deliveryDate, "2025-01-01");

  // 确保所有明细的日期都能安全被 Date 接收且杜绝 Invalid Date
  for (const item of parsed) {
    const d = Invariants.normalizeDate(item.deliveryDate);
    assert.ok(!isNaN(d.getTime()), `deliveryDate [${item.deliveryDate}] 必须可转为合法有效 Date 对象`);
    assert.equal(d.toISOString().slice(0, 10), "2025-01-01");
  }

  console.log("  ✔ 用户报障场景回归测试通过\n");
}

// 6. 图二业务模板测试：发货时间 + 门店 + 门店编号(可选) + 规格单列(4.0公蟹) + 只数 -> 系统按 发货时间+门店编号+规格 编排
{
  console.log("▶ [Test 6] 图二业务模板测试 (单列规格 + 精准门店编号 + 规则确定性编单)");
  const fig2Text = `发货时间\t门店\t门店编号\t规格\t只数
20260904\t浦东山姆店\t1\t4.0公蟹\t300
20260904\t浦东山姆店\t1\t5.0公蟹\t300
20260904\t前滩山姆店\t3.5母蟹\t200`;

  const parsed = Invariants.parseOrderImportText(fig2Text, "STORE");
  assert.equal(parsed.length, 3, "表头应被过滤，正确解析 3 条门店要货明细");

  // 第一条：浦东店(编号1) 4.0公蟹 300只 -> SO20260904-1-4.0公
  assert.equal(parsed[0].orderNo, "SO20260904-1-4.0公");
  assert.equal(parsed[0].storeName, "浦东山姆店");
  assert.equal(parsed[0].deliveryDate, "2026-09-04");
  assert.equal(parsed[0].gender, "MALE");
  assert.equal(parsed[0].weightTier, "4.0两");
  assert.equal(parsed[0].count, 300);

  // 第二条：浦东店(编号1) 5.0公蟹 300只 -> SO20260904-1-5.0公
  assert.equal(parsed[1].orderNo, "SO20260904-1-5.0公");
  assert.equal(parsed[1].storeName, "浦东山姆店");
  assert.equal(parsed[1].deliveryDate, "2026-09-04");
  assert.equal(parsed[1].gender, "MALE");
  assert.equal(parsed[1].weightTier, "5.0两");
  assert.equal(parsed[1].count, 300);

  // 第三条：前滩店无门店编号，使用门店简称 -> SO20260904-前滩-3.5母
  assert.equal(parsed[2].orderNo, "SO20260904-前滩-3.5母");
  assert.equal(parsed[2].storeName, "前滩山姆店");
  assert.equal(parsed[2].deliveryDate, "2026-09-04");
  assert.equal(parsed[2].gender, "FEMALE");
  assert.equal(parsed[2].weightTier, "3.5两");
  assert.equal(parsed[2].count, 200);

  console.log("  ✔ 图二格式自适应与确定性订单号测试通过\n");
}

// 7. 用户最新截图《10月26日发货计划》真实矩阵交叉二维表还原测试
{
  console.log("▶ [Test 7] 真实业务场景：多门店×多规格矩阵式发货计划整表解析与自动编单");
  const matrixText = `10月26日发货计划(单位:只)
发货地点\t门店\t业务\t渠道\t2.5母\t3.5公\t3.0母\t4.0公\t3.5母\t4.5公\t整箱数量\t分货
南宁山姆店\t6532\t陈建国\t山姆\t\t\t\t\t\t\t0\t苏州
北京大兴店\t6519\t张东洋\t山姆\t160\t120\t140\t100\t60\t50\t630\t苏州
上海浦东店\t4807\t马博文\t山姆\t\t\t70\t50\t\t\t120\t苏州`;

  const parsed = Invariants.parseOrderImportText(matrixText, "STORE");

  // 南宁店数量为 0，不生成订单；北京大兴店 6 个规格生成 6 笔；上海浦东店 2 个规格生成 2 笔
  assert.equal(parsed.length, 8, "应准确拆解为 8 笔单规格发货订单");

  // 校验日期自动从标题识别为当前年份-10-26
  const expectedDate = `${new Date().getFullYear()}-10-26`;
  const expectedDateNum = `${new Date().getFullYear()}1026`;

  // 校验上海浦东店 (编号 4807)
  const pudongOrders = parsed.filter(o => o.storeName === "上海浦东店");
  assert.equal(pudongOrders.length, 2);

  // 3.0母 70 只
  const pd30F = pudongOrders.find(o => o.gender === "FEMALE" && o.weightTier === "3.0两");
  assert.ok(pd30F, "上海浦东店应包含 3.0两母蟹订单");
  assert.equal(pd30F.count, 70);
  assert.equal(pd30F.orderNo, `SO${expectedDateNum}-4807-3.0母`, "订单号格式严格为 SO+发货日期+门店编号+规格");
  assert.equal(pd30F.deliveryDate, expectedDate);

  // 4.0公 50 只
  const pd40M = pudongOrders.find(o => o.gender === "MALE" && o.weightTier === "4.0两");
  assert.ok(pd40M, "上海浦东店应包含 4.0两公蟹订单");
  assert.equal(pd40M.count, 50);
  assert.equal(pd40M.orderNo, `SO${expectedDateNum}-4807-4.0公`);

  // 校验北京大兴店 (编号 6519)
  const daxingOrders = parsed.filter(o => o.storeName === "北京大兴店");
  assert.equal(daxingOrders.length, 6);
  assert.equal(daxingOrders.reduce((sum, o) => sum + o.count, 0), 630, "北京大兴店总只数应准确对齐表格合计 630 只");

  assert.ok(daxingOrders.some(o => o.orderNo === `SO${expectedDateNum}-6519-2.5母` && o.count === 160));
  assert.ok(daxingOrders.some(o => o.orderNo === `SO${expectedDateNum}-6519-4.5公` && o.count === 50));

  console.log("  ✔ 矩阵式发货计划二维表整表自动拆单与确定性订单号测试通过\n");
}

console.log("🎉 订单导入智能拆分与日期防爆单元测试全部 100% 通过！");
