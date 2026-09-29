import assert from "node:assert/strict";

function normalizeEnclosureCodes(codes: string[]) {
  return codes
    .map((code) =>
      code
        .trim()
        .replace(/[\u2014\u2013\uFF0D\u2015]/g, "-")
        .toUpperCase()
    )
    .filter(Boolean);
}

// 优化的围网同步逻辑
function syncEnclosures(
  existingEnclosures: Array<{ id: string; code: string; batchesCount: number }>,
  inputCodes: string[]
) {
  const newCodes = normalizeEnclosureCodes(inputCodes);

  // 1. 先做编码归一化匹配 (例如数据库中旧的 GZ032—1 匹配到新输入的 GZ032-1)
  const codeToExisting = new Map<string, (typeof existingEnclosures)[0]>();
  for (const e of existingEnclosures) {
    const norm = normalizeEnclosureCodes([e.code])[0];
    codeToExisting.set(norm, e);
  }

  const matchedExistingIds = new Set<string>();
  const toUpdateCodes: Array<{ id: string; code: string }> = [];
  const unmatchedNewCodes: string[] = [];

  for (const code of newCodes) {
    const matched = codeToExisting.get(code);
    if (matched) {
      matchedExistingIds.add(matched.id);
      if (matched.code !== code) {
        toUpdateCodes.push({ id: matched.id, code });
      }
    } else {
      unmatchedNewCodes.push(code);
    }
  }

  let unmatchedOld = existingEnclosures.filter((e) => !matchedExistingIds.has(e.id));

  // 2. 如果恰好有且仅有 1 个旧围网未匹配，且有 1 个新围网未匹配 -> 认定为更名操作 (Rename)
  if (unmatchedOld.length === 1 && unmatchedNewCodes.length === 1) {
    const oldToRename = unmatchedOld[0];
    const newCode = unmatchedNewCodes[0];
    toUpdateCodes.push({ id: oldToRename.id, code: newCode });
    unmatchedOld = [];
    unmatchedNewCodes.length = 0;
  }

  // 3. 检查剩余的未匹配旧围网：若有关联批次，严禁删除/丢弃
  for (const e of unmatchedOld) {
    if (e.batchesCount > 0) {
      throw new Error(`围网 ${e.code} 已有关联的原料批次，无法直接移除或替换`);
    }
  }

  const toDeleteIds = unmatchedOld.map((e) => e.id);
  const toCreateCodes = [...unmatchedNewCodes];

  // 模拟数据库更新后的最终状态
  const remaining = existingEnclosures
    .filter((e) => !toDeleteIds.includes(e.id))
    .map((e) => {
      const updated = toUpdateCodes.find((u) => u.id === e.id);
      return updated ? updated.code : normalizeEnclosureCodes([e.code])[0];
    });

  const finalCodes = [...remaining, ...toCreateCodes];

  return { toDeleteIds, toCreateCodes, toUpdateCodes, finalCodes };
}

// Case 1: 破折号纠偏 (GZ032—1 -> GZ032-1)
{
  const existing = [{ id: "enc-1", code: "GZ032—1", batchesCount: 1 }];
  const result = syncEnclosures(existing, ["GZ032-1"]);
  assert.deepEqual(result.finalCodes, ["GZ032-1"]);
  assert.equal(result.toUpdateCodes.length, 1);
  assert.equal(result.toCreateCodes.length, 0);
  assert.equal(result.toDeleteIds.length, 0);
  console.log("✔ Case 1 passed: 破折号自动匹配并纠偏，围网数量不增加");
}

// Case 2: 显式更名 (W-01 -> W-01-A，且有批次)
{
  const existing = [{ id: "enc-1", code: "W-01", batchesCount: 2 }];
  const result = syncEnclosures(existing, ["W-01-A"]);
  assert.deepEqual(result.finalCodes, ["W-01-A"]);
  assert.equal(result.toUpdateCodes.length, 1);
  assert.equal(result.toCreateCodes.length, 0);
  assert.equal(result.toDeleteIds.length, 0);
  console.log("✔ Case 2 passed: 单围网更名成功，保留已有批次关联");
}

// Case 3: 新增围网 (W-01 -> W-01, W-02)
{
  const existing = [{ id: "enc-1", code: "W-01", batchesCount: 1 }];
  const result = syncEnclosures(existing, ["W-01", "W-02"]);
  assert.deepEqual(result.finalCodes, ["W-01", "W-02"]);
  assert.equal(result.toCreateCodes.length, 1);
  assert.equal(result.toCreateCodes[0], "W-02");
  console.log("✔ Case 3 passed: 正常新增围网");
}

// Case 4: 删除无批次的闲置围网
{
  const existing = [
    { id: "enc-1", code: "W-01", batchesCount: 1 },
    { id: "enc-2", code: "W-02", batchesCount: 0 },
  ];
  const result = syncEnclosures(existing, ["W-01"]);
  assert.deepEqual(result.finalCodes, ["W-01"]);
  assert.deepEqual(result.toDeleteIds, ["enc-2"]);
  console.log("✔ Case 4 passed: 安全删除无批次闲置围网");
}

// Case 6: 历史脏数据自愈 (已有 GZ032—1[1批次] 和 GZ032-1[0批次]，保存 GZ032-1 时自动清理幽灵围网)
{
  let existing = [
    { id: "enc-1", code: "GZ032—1", batchesCount: 1 },
    { id: "enc-2", code: "GZ032-1", batchesCount: 0 },
  ];

  // 自愈：先清理同归一化编码下无批次的重复项
  const normMap = new Map<string, typeof existing>();
  for (const e of existing) {
    const norm = normalizeEnclosureCodes([e.code])[0];
    const list = normMap.get(norm) || [];
    list.push(e);
    normMap.set(norm, list);
  }
  const autoCleanedIds: string[] = [];
  for (const [norm, list] of normMap.entries()) {
    if (list.length > 1) {
      const withBatches = list.filter((e) => e.batchesCount > 0);
      const withoutBatches = list.filter((e) => e.batchesCount === 0);
      if (withBatches.length <= 1 && withoutBatches.length > 0) {
        autoCleanedIds.push(...withoutBatches.map((e) => e.id));
        existing = existing.filter((e) => !autoCleanedIds.includes(e.id));
      }
    }
  }

  const result = syncEnclosures(existing, ["GZ032-1"]);
  assert.deepEqual(result.finalCodes, ["GZ032-1"]);
  assert.deepEqual(autoCleanedIds, ["enc-2"]);
  console.log("✔ Case 6 passed: 历史脏数据自愈，清理幽灵围网并保留批次归并为单个标准围网");
}

console.log("ALL TESTS PASSED!");
