import assert from "node:assert/strict";

/**
 * 诊断与回归测试：保鲜预冷与出库管理数据对账
 * 复现用户截图中的真实场景：
 * 保鲜预冷库中有 4 笔入库批次共 4,080 只：
 * - CR-0901: 公蟹 4.0两 (1,020 只) [A区]
 * - CR-0902: 母蟹 3.0两 (1,020 只) [A区]
 * - CR-0903: 公蟹 3.5两 (1,020 只) [B区]
 * - CR-0904: 母蟹 2.5两 (1,020 只) [B区]
 */

const DEFAULT_BASE_SPECS = [
  { gender: "MALE", weightTier: "4.0两" },
  { gender: "MALE", weightTier: "3.5两" },
  { gender: "FEMALE", weightTier: "3.5两" },
  { gender: "FEMALE", weightTier: "3.0两" },
];

export function computeDynamicSpecStocks({
  sortTasks,
  outboundLines = [],
}: {
  sortTasks: Array<{ gender: string; weightTier: string; qualifiedCount: number }>;
  coldLogs?: any[];
  pendingOrders?: any[];
  outboundLines?: Array<{ gender: string; weightTier: string; count: number }>;
}) {
  const DEFAULT_SPECS = [
    { gender: "MALE", weightTier: "4.0两", label: "4.0两 公蟹" },
    { gender: "MALE", weightTier: "3.5两", label: "3.5两 公蟹" },
    { gender: "FEMALE", weightTier: "3.5两", label: "3.5两 母蟹" },
    { gender: "FEMALE", weightTier: "3.0两", label: "3.0两 母蟹" },
  ];

  const foundSpecs = Array.from(
    new Set(sortTasks.map((t) => `${t.gender}_${t.weightTier}`))
  ).map((k) => {
    const [gender, weightTier] = k.split("_");
    return { gender, weightTier, label: `${weightTier} ${gender === "FEMALE" ? "母蟹" : "公蟹"}` };
  });

  const activeSpecs = [
    ...foundSpecs,
    ...DEFAULT_SPECS.filter((d) => !foundSpecs.some((s) => s.gender === d.gender && s.weightTier === d.weightTier)),
  ].slice(0, Math.max(4, foundSpecs.length))
   .sort((a, b) => (a.gender !== b.gender ? (a.gender === "MALE" ? -1 : 1) : parseFloat(b.weightTier) - parseFloat(a.weightTier)));

  return activeSpecs.map((spec) => {
    const qualified = sortTasks
      .filter((t) => t.gender === spec.gender && t.weightTier === spec.weightTier)
      .reduce((a, t) => a + t.qualifiedCount, 0);

    const used = outboundLines
      .filter((l) => l.gender === spec.gender && l.weightTier === spec.weightTier)
      .reduce((a, l) => a + l.count, 0);

    const available = Math.max(0, qualified - used);
    const usagePct = qualified > 0 ? Math.min(100, Math.round((used / qualified) * 100)) : 0;

    return { ...spec, qualified, used, available, usagePct };
  });
}

function testDynamicCalculation() {
  console.log("================================================================================");
  console.log("🧪 验证动态规格计算逻辑在用户真实场景下的对账表现");
  console.log("================================================================================\n");

  const coldLogs = [
    { code: "CR-0901", storeName: "A区 (BX-01)", count: 1020, gender: "MALE", weightTier: "4.0两", refTask: "FJR2026090502" },
    { code: "CR-0902", storeName: "A区 (BX-01)", count: 1020, gender: "FEMALE", weightTier: "3.0两", refTask: "FJR2026090503" },
    { code: "CR-0903", storeName: "B区 (BX-02)", count: 1020, gender: "MALE", weightTier: "3.5两", refTask: "FJR2026090501" },
    { code: "CR-0904", storeName: "B区 (BX-02)", count: 1020, gender: "FEMALE", weightTier: "2.5两", refTask: "FJR2026090504" },
  ];

  const totalColdStored = coldLogs.reduce((acc, l) => acc + l.count, 0);

  const sortTasks = coldLogs.map(l => ({
    code: l.refTask,
    gender: l.gender,
    weightTier: l.weightTier,
    qualifiedCount: l.count,
    status: "COMPLETED",
  }));

  const specStocks = computeDynamicSpecStocks({
    sortTasks,
    coldLogs,
    pendingOrders: [],
    outboundLines: [],
  });

  console.log(`[保鲜预冷] 累计入库总量: ${totalColdStored} 只`);
  const outboundTotal = specStocks.reduce((acc, s) => acc + s.available, 0);
  console.log(`[出库管理] 动态规格卡总可用数: ${outboundTotal} 只`);

  specStocks.forEach((s) => {
    console.log(`  ✔ [${s.label}] 合格: ${s.qualified} 只, 可出: ${s.available} 只, 占用: ${s.usagePct}%`);
  });

  // 1. 验证总数精确轧平相等
  assert.equal(outboundTotal, totalColdStored, "动态规格卡总库存应与保鲜库总入库 4080 只严格轧平！");

  // 2. 验证保鲜库中的每种规格都有对应规格卡与正确余量
  const specMap = new Map(specStocks.map((s) => [`${s.gender}_${s.weightTier}`, s.available]));
  assert.equal(specMap.get("MALE_4.0两"), 1020, "公蟹 4.0两 应有 1020 只");
  assert.equal(specMap.get("MALE_3.5两"), 1020, "公蟹 3.5两 应有 1020 只");
  assert.equal(specMap.get("FEMALE_3.0两"), 1020, "母蟹 3.0两 应有 1020 只");
  assert.equal(specMap.get("FEMALE_2.5两"), 1020, "母蟹 2.5两 应有 1020 只");

  console.log("\n🎉 动态规格库存计算完美通过！出库管理与保鲜预冷数据 100% 对齐！\n");
}

testDynamicCalculation();
