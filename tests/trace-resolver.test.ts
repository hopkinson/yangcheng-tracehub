import assert from "node:assert/strict";
import { resolveTraceQuery } from "../src/lib/trace-service";

async function runTraceTests() {
  console.log("🦀 启动追溯查询 (PRD 16) 全链路逆向解析自动化测试...\n");

  // 1. 门店订单已发货查询 (SM20260920001)
  console.log("▶ [Test 1] 门店订单号检索 (SM20260920001)");
  const res1 = await resolveTraceQuery("SM20260920001");
  assert.ok(res1, "应能查出门店订单溯源档案");
  assert.equal(res1.found, true);
  assert.equal(res1.mode, "ORDER");
  assert.equal(res1.isPreview, false);
  assert.equal(res1.lines[0].chain.length, 6, "应包含完整的六环节溯源链");
  console.log("  ✔ 门店订单全链路溯源解析成功 (6/6 环节)");

  // 2. 出库单号检索 (CK2026092101) - 验证全环节层层绑定闭环一致性
  console.log("▶ [Test 2] 出库单号检索 (CK2026092101)");
  const res2 = await resolveTraceQuery("CK2026092101");
  assert.ok(res2, "应能查出出库单溯源档案");
  assert.equal(res2.outboundInfo?.code, "CK2026092101");
  assert.equal(res2.farmerInfo.code, "JD-2026-001");
  assert.equal(res2.farmerInfo.name, "张卫民");

  const chain = res2.lines[0].chain;
  assert.equal(chain[0].stageName, "原料");
  assert.ok(chain[0].title.includes("YL2026092001"), "环节1应为张卫民批次 YL2026092001");
  assert.equal(chain[1].stageName, "暂养");
  assert.ok(chain[1].title.includes("ZY-01"), "环节2应为恒温暂养池 ZY-01");
  assert.equal(chain[2].stageName, "捆扎");
  assert.ok(chain[2].subtitle.includes("XK2026092001"), "环节3蟹扣批次应为张卫民专属批次 XK2026092001");
  assert.equal(chain[3].stageName, "分拣");
  assert.ok(chain[3].title.includes("FJR2026092101"), "环节4分拣任务应为 FJR2026092101");
  assert.equal(chain[4].stageName, "预冷");
  assert.ok(chain[4].title.includes("BX-01") && chain[4].subtitle.includes("CR-0901"), "环节5预冷应精准对应 CR-0901");
  assert.equal(chain[5].stageName, "出库");
  console.log("  ✔ 出库单全链路层层绑定验证成功 (原料->入池->蟹扣->捆扎->分拣->预冷->出库 100% 同源一致)");

  // 3. 蟹卡待出库预览检索 (KK20260920055)
  console.log("▶ [Test 3] 蟹卡待出库预览 (KK20260920055)");
  const res3 = await resolveTraceQuery("KK20260920055");
  assert.ok(res3, "应能检索到待发货订单");
  assert.equal(res3.isPreview, true, "待出库订单应标记为预览模式");
  assert.equal(res3.lines[0].chain[0].status, "PREVIEW");
  console.log("  ✔ 待出库订单履约链路预览推演成功");

  // 4. 空查询 / 不存在单号
  console.log("▶ [Test 4] 不存在单号检索");
  const res4 = await resolveTraceQuery("NONEXISTENT_9999");
  assert.equal(res4, null, "不存在单号应返回 null");
  console.log("  ✔ 未匹配单号正确返回空结果");

  console.log("\n🎉 追溯查询全链路自动化测试 100% 通过！");
}

runTraceTests().catch((err) => {
  console.error("❌ 追溯测试失败:", err);
  process.exit(1);
});
