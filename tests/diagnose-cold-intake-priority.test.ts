import assert from "node:assert/strict";

/**
 * 诊断测试：保鲜预冷入库登记批次先进先出与「当前优先」提醒逻辑
 * 用户真实场景：
 * - 原料批次 YL2026092101 已全部完成预冷入库（可用待入库 0 只）
 * - 原料批次 YL2026092102 仍有待入库 326 只
 * 
 * 缺陷表现：
 * - 下拉选项第 1 项 YL2026092101 显示："YL2026092101 · 已全部入库，当前优先"
 * - 错误地将已完成入库的批次标注为「当前优先」，且选框未自动流转到真正待入库的 YL2026092102，
 *   导致页面出现「该原料批次的所有分拣大闸蟹已全部完成入库（待入库余量 0 只），不可重复登记」的告警阻断。
 */

export interface SourceBatch {
  id: string;
  code: string;
  inPoolTime: string;
  availableCount: number;
}

// 模拟旧代码中生成下拉选项标签的逻辑
export function getOldBatchLabel(batch: SourceBatch, index: number): string {
  return `${batch.code} · ${batch.availableCount > 0 ? `待入库 ${batch.availableCount} 只` : "已全部入库"}${index === 0 ? " · 当前优先" : ""}`;
}

// 预期的正确逻辑：
// 1. 只有真正有待入库余量（availableCount > 0）的批次，按入池时间先进先出，最早的那批才是「当前优先」
// 2. 已全部入库（availableCount === 0）的批次，绝不能标注为「当前优先」
export function getExpectedBatchPriorityInfo(batches: SourceBatch[]) {
  // 找出第一个有待入库余量的批次作为当前优先
  const priorityBatch = batches.find((b) => b.availableCount > 0);
  return {
    priorityBatchId: priorityBatch?.id || null,
  };
}

export function formatBatchLabel(batch: SourceBatch, priorityBatchId: string | null): string {
  const statusText = batch.availableCount > 0 ? `待入库 ${batch.availableCount} 只` : "已全部入库";
  let priorityTag = "";
  if (batch.availableCount > 0) {
    if (batch.id === priorityBatchId) {
      priorityTag = " · 当前优先";
    } else {
      priorityTag = " · 待前序完成";
    }
  }
  return `${batch.code} · ${statusText}${priorityTag}`;
}

// 测试用例 1：复现旧逻辑的 Bug
function testOldLogicFails() {
  const batches: SourceBatch[] = [
    { id: "batch-1", code: "YL2026092101", inPoolTime: "2026-09-21T08:00:00.000Z", availableCount: 0 },
    { id: "batch-2", code: "YL2026092102", inPoolTime: "2026-09-21T09:00:00.000Z", availableCount: 326 },
  ];

  const oldLabel0 = getOldBatchLabel(batches[0], 0);
  const oldLabel1 = getOldBatchLabel(batches[1], 1);

  console.log("旧逻辑生成结果：");
  console.log("  批次 0 标签:", oldLabel0);
  console.log("  批次 1 标签:", oldLabel1);

  // 旧逻辑会输出已全部入库却依然是当前优先：
  assert.ok(
    oldLabel0.includes("已全部入库 · 当前优先"),
    "旧逻辑错误地给已入库批次打上了当前优先标签"
  );
  assert.ok(
    !oldLabel1.includes("当前优先"),
    "旧逻辑未能将有余量的批次标记为当前优先"
  );
}

// 测试用例 2：验证修复后的预期行为
function testFixedLogicPasses() {
  const batches: SourceBatch[] = [
    { id: "batch-1", code: "YL2026092101", inPoolTime: "2026-09-21T08:00:00.000Z", availableCount: 0 },
    { id: "batch-2", code: "YL2026092102", inPoolTime: "2026-09-21T09:00:00.000Z", availableCount: 326 },
    { id: "batch-3", code: "YL2026092103", inPoolTime: "2026-09-21T10:00:00.000Z", availableCount: 500 },
  ];

  const { priorityBatchId } = getExpectedBatchPriorityInfo(batches);
  assert.equal(priorityBatchId, "batch-2", "当前优先批次必须是有余量且入池最早的 batch-2");

  const label0 = formatBatchLabel(batches[0], priorityBatchId);
  const label1 = formatBatchLabel(batches[1], priorityBatchId);
  const label2 = formatBatchLabel(batches[2], priorityBatchId);

  console.log("\n预期新逻辑结果：");
  console.log("  批次 1 (已入清):", label0);
  console.log("  批次 2 (待入库最早):", label1);
  console.log("  批次 3 (待入库后续):", label2);

  assert.equal(label0, "YL2026092101 · 已全部入库", "已全部入库的批次不能带有当前优先");
  assert.equal(label1, "YL2026092102 · 待入库 326 只 · 当前优先", "批次 2 必须被标记为当前优先");
  assert.equal(label2, "YL2026092103 · 待入库 500 只 · 待前序完成", "批次 3 必须被标记为待前序完成");
}

try {
  testOldLogicFails();
  testFixedLogicPasses();
  console.log("\n✅ 诊断测试通过！问题机理已精确复现与定位。");
} catch (e: any) {
  console.error("❌ 测试失败:", e.message);
  process.exit(1);
}
