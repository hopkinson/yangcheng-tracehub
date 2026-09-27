import assert from "node:assert/strict";
import { aggregateTraceableColdStocksByStore } from "../src/lib/cold-stock";

const sortTasks = [
  { id: "task-a", code: "FJ-A", gender: "MALE", weightTier: "4.0两", bundleBatch: { sourceBatchId: "batch-a" } },
  { id: "task-b", code: "FJ-B", gender: "FEMALE", weightTier: "3.5两", bundleBatch: { sourceBatchId: "batch-b" } },
];

const locations = aggregateTraceableColdStocksByStore({
  sortTasks,
  coldLogs: [
    { id: "log-a1", count: 100, type: "INTAKE", sortTaskId: "task-a", store: { id: "store-a", name: "一号库", code: "CK-01" } },
    { id: "log-a2", count: 50, type: "INTAKE", sortTaskId: "task-b", store: { id: "store-a", name: "一号库", code: "CK-01" } },
    { id: "log-b1", count: 80, type: "INTAKE", sortTaskId: "task-a", store: { id: "store-b", name: "二号库", code: "CK-02" } },
  ],
  outboundLines: [{ coldLogId: "log-a1", count: 10 }],
  outboundLosses: [
    { coldLogId: "log-a1", count: 5, status: "APPROVED", lossType: "PACKAGING" },
    { coldLogId: "log-a1", count: 3, status: "APPROVED", lossType: "CLEARANCE" },
    { coldLogId: "log-a1", count: 4, status: "REJECTED", lossType: "PACKAGING" },
    { coldLogId: "log-b1", count: 7, status: "APPROVED", lossType: "CLEARANCE" },
  ],
});

assert.equal(locations.length, 2);
assert.equal(locations[0].storeName, "一号库");
assert.equal(locations[0].totalAvailable, 132);
assert.deepEqual(
  locations[0].stocks.map((stock) => [stock.label, stock.available]),
  [["4.0两 公蟹", 82], ["3.5两 母蟹", 50]],
);
const male4 = locations[0].stocks.find((stock) => stock.gender === "MALE" && stock.weightTier === "4.0两");
assert.equal(male4?.packagingLoss, 5, "包装损耗应独立累计且忽略 REJECTED");
assert.equal(male4?.clearanceLoss, 3, "清库损耗应与包装损耗分开累计");
assert.equal(locations[1].storeName, "二号库");
assert.equal(locations[1].totalAvailable, 73);

console.log("✔ 包装损耗库存按库位隔离并支持同库位多规格汇总");
