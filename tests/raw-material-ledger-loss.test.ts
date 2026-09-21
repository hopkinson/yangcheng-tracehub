import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

// 提取台账中的原料批次行计算逻辑进行单元回归测试
function calculateRawMaterialLedgerMetrics(
  batch: any,
  item: any
) {
  const itemTier = Invariants.normalizeWeightTier(item.weightTier);
  let downstreamShipped = 0;
  let downstreamLoss = 0;
  let hasDownstream = false;

  if (batch.bundleBatches?.length) {
    for (const bb of batch.bundleBatches) {
      for (const line of bb.lines || []) {
        if (line.gender === item.gender && Invariants.normalizeWeightTier(line.weightTier) === itemTier) {
          hasDownstream = true;
          const lineLoss = line.lossCount ?? (bb.lines.length === 1 ? bb.lossCount : 0);
          downstreamLoss += lineLoss || 0;
        }
      }
      for (const st of bb.sortTasks || []) {
        if (st.gender === item.gender && Invariants.normalizeWeightTier(st.weightTier) === itemTier) {
          hasDownstream = true;
          downstreamLoss += st.lossCount || 0;
          for (const cl of st.coldLogs || []) {
            for (const ol of cl.outboundLines || []) {
              downstreamShipped += ol.count || 0;
            }
            for (const loss of cl.outboundLosses || []) {
              downstreamLoss += loss.count || 0;
            }
          }
        }
      }
    }
  }

  const shipped = hasDownstream ? downstreamShipped : item.outPoolCount;
  const totalLoss = hasDownstream ? item.lossCount + downstreamLoss : item.lossCount;
  const inPoolRemaining = Math.max(0, item.inPoolCount - item.outPoolCount - item.lossCount);

  return {
    inPoolRemaining,
    shipped,
    totalLoss,
    lossRateText: `${((totalLoss / item.inPoolCount) * 100).toFixed(2)}%`,
  };
}

function testRawMaterialLedgerOutboundLossSeparation() {
  console.log("▶ [Test] 原料批次台账：发货损耗与真实发货穿透计算解耦回归测试");

  // 模拟用户截图中的实际业务场景：
  // 1. 原料入池 120 只 (3.5两 公蟹)
  // 2. 全量起池捆扎 120 只 (outPoolCount = 120)
  // 3. 捆扎合格 120 只、分拣合格 120 只
  // 4. 冷库发货 115 只，发货损耗 5 只
  const mockBatch = {
    code: "YL2026092102",
    inPoolCount: 120,
    outPoolCount: 120,
    lossCount: 0,
    bundleBatches: [
      {
        lines: [
          { gender: "MALE", weightTier: "3.5两", count: 120, lossCount: 0 },
        ],
        sortTasks: [
          {
            gender: "MALE",
            weightTier: "3.5两",
            lossCount: 0,
            coldLogs: [
              {
                outboundLines: [{ count: 115 }],
                outboundLosses: [{ count: 5 }],
              },
            ],
          },
        ],
      },
    ],
  };

  const mockItem = {
    gender: "MALE",
    weightTier: "3.5两",
    inPoolCount: 120,
    outPoolCount: 120,
    lossCount: 0,
  };

  const result = calculateRawMaterialLedgerMetrics(mockBatch, mockItem);

  console.log("计算结果:", result);

  // 守恒校验 1: 发货数必须为实际审核出库数 (115)，绝不得把 5 只发货损耗混入发货 (不能等于 120)
  assert.equal(result.shipped, 115, "发货数应为真实出库发货数 115 只（发货损耗绝不能算在发货里）");

  // 守恒校验 2: 累计损耗必须计入发货损耗 (5 只)
  assert.equal(result.totalLoss, 5, "累计损耗必须准确归集后道冷库发货损耗 5 只");

  // 守恒校验 3: 损耗率必须按真实总损耗计算 5 / 120 = 4.17%
  assert.equal(result.lossRateText, "4.17%", "损耗率必须为 4.17%");

  // 守恒校验 4: 在池数
  assert.equal(result.inPoolRemaining, 0, "在池活蟹数量应为 0");

  console.log("  ✔ 发货损耗准确归入累计损耗，真实发货与发货损耗严格分离校验通过\n");
}

function testLegacyDirectOutboundBatchCompatibility() {
  console.log("▶ [Test] 历史无后道单据批次兼容性测试");

  const legacyBatch = {
    code: "YL-LEGACY-001",
    inPoolCount: 100,
    outPoolCount: 80,
    lossCount: 20,
    bundleBatches: [],
  };

  const legacyItem = {
    gender: "FEMALE",
    weightTier: "3.0两",
    inPoolCount: 100,
    outPoolCount: 80,
    lossCount: 20,
  };

  const result = calculateRawMaterialLedgerMetrics(legacyBatch, legacyItem);
  assert.equal(result.shipped, 80, "无后道单据时兼容历史直接出库数");
  assert.equal(result.totalLoss, 20, "无后道单据时兼容历史暂养损耗数");
  console.log("  ✔ 历史无工序单据兼容测试通过\n");
}

testRawMaterialLedgerOutboundLossSeparation();
testLegacyDirectOutboundBatchCompatibility();
console.log("🎉 全部原料台账发货损耗解耦测试通过！");
