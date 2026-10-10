import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { calculateFarmerLedger, farmerLedgerSelect, getFarmerLedgerRows } from "../src/lib/farmer-ledger";

const prisma = new PrismaClient();
const rollback = new Error("rollback ledger test fixtures");

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const suffix = `ledger-${Date.now()}`;
      const user = await tx.user.create({ data: { username: suffix, fullName: suffix, phone: suffix, role: "ADMIN" } });
      const farmer = await tx.farmer.create({ data: {
        code: suffix, name: suffix, phone: suffix, farmType: "LAKE_CRAB", year: 2026, area: 5, quota: 3000,
      } });
      const enclosure = await tx.enclosure.create({ data: { code: suffix, farmerId: farmer.id } });
      const pool = await tx.holdingPool.create({ data: { code: suffix, name: suffix } });
      const batchData = { farmerId: farmer.id, enclosureId: enclosure.id, poolId: pool.id, createdById: user.id };
      const batch = await tx.batch.create({ data: {
        ...batchData, code: suffix, inPoolTime: new Date("2025-12-31T16:00:00Z"), inPoolCount: 1000, lossCount: 10,
        // 同一损耗同时存于明细和记录时，不得重复累计。
        items: { create: { poolId: pool.id, gender: "MALE", weightTier: "4.0两", inPoolCount: 1000, lossCount: 10 } },
      } });
      await tx.batch.create({ data: {
        ...batchData, code: `${suffix}-previous`, inPoolTime: new Date("2025-12-31T15:59:59Z"), inPoolCount: 900, lossCount: 90,
      } });
      await tx.batch.create({ data: {
        ...batchData, code: `${suffix}-next`, inPoolTime: new Date("2026-12-31T16:00:00Z"), inPoolCount: 500,
      } });
      const claim = await tx.tagClaim.create({ data: {
        farmerId: farmer.id, applicantId: user.id, claimDate: new Date("2026-01-01T00:00:00Z"),
        claimCount: 1000, boundCount: 982, scrappedCount: 123, returnedCount: 2, status: "APPROVED",
      } });
      for (const status of ["PENDING", "REJECTED"]) {
        await tx.tagClaim.create({ data: {
          farmerId: farmer.id, applicantId: user.id, claimDate: claim.claimDate, claimCount: 500, status,
        } });
      }
      await tx.tagClaim.create({ data: {
        farmerId: farmer.id, applicantId: user.id, claimDate: new Date("2025-12-31T15:59:59Z"), claimCount: 700, status: "APPROVED",
      } });
      const group = await tx.bundleGroup.create({ data: { code: suffix, name: suffix } });
      const bundleData = { sourceBatchId: batch.id, tagClaimId: claim.id, groupId: group.id, ropeBatch: suffix };
      const bundle = await tx.bundleBatch.create({ data: {
        ...bundleData, code: suffix, status: "COMPLETED", inputCount: 990, qualifiedCount: 982, lossCount: 8,
      } });
      await tx.bundleBatch.create({ data: {
        ...bundleData, code: `${suffix}-pending`, status: "BUNDLING", qualifiedCount: 400, lossCount: 400,
      } });
      const machine = await tx.sortMachine.create({ data: { code: suffix, name: suffix } });
      const taskData = { bundleBatchId: bundle.id, machineId: machine.id, gender: "MALE", weightTier: "4.0两", inputCount: 982 };
      const task = await tx.sortTask.create({ data: {
        ...taskData, code: suffix, status: "COMPLETED", qualifiedCount: 977, lossCount: 5,
      } });
      await tx.sortTask.create({ data: { ...taskData, code: `${suffix}-pending`, status: "PENDING", lossCount: 300 } });
      const coldStore = await tx.coldStore.create({ data: { code: suffix, name: suffix } });
      const cold = await tx.coldLog.create({ data: {
        code: suffix, storeId: coldStore.id, sortTaskId: task.id, count: 977, operator: suffix,
      } });
      for (const status of ["APPROVED", "PENDING", "REJECTED"]) {
        for (const [lossType, count] of [["PACKAGING", 3], ["CLEARANCE", 7]] as const) {
          await tx.outboundLossRecord.create({ data: {
            coldLogId: cold.id, operatorId: user.id, gender: "MALE", weightTier: "4.0两", reason: suffix, lossType, count, status,
          } });
        }
      }
      const channel = await tx.channel.create({ data: { name: suffix } });
      const store = await tx.store.create({ data: { code: suffix, name: suffix, channelId: channel.id } });
      for (const status of ["APPROVED", "PENDING", "REJECTED"]) {
        await tx.outboundOrder.create({ data: {
          code: `${suffix}-${status}`, batchId: batch.id, storeId: store.id, channelId: channel.id,
          applicantId: user.id, status, outboundCount: 800, channelOrderCount: 800,
          // 下一年出库仍归属原料入池年度。
          outboundTime: new Date("2027-01-01T00:00:00Z"),
          lines: { create: { coldLogId: cold.id, gender: "MALE", weightTier: "4.0两", count: 800, orderNo: suffix } },
        } });
      }
      const selected = await tx.farmer.findUniqueOrThrow({ where: { id: farmer.id }, select: farmerLedgerSelect });
      const result = calculateFarmerLedger(selected);
      const [filtered] = await getFarmerLedgerRows(tx, [farmer.id]);
      assert.equal(filtered.batches.length, 1, "数据库只读取养殖年度内的批次");
      assert.equal(filtered.tagClaims.length, 1, "数据库只读取养殖年度内已审核的申领");
      assert.deepEqual(calculateFarmerLedger(filtered), result, "年度前置过滤不能改变累计口径或丢失跨年出库");
      assert.deepEqual(await getFarmerLedgerRows(tx, []), []);
      assert.deepEqual(result, {
        cumulativeInPool: 1000, cumulativeClaimed: 1000, cumulativeBound: 982, cumulativeReturned: 2,
        holdingLoss: 10, totalLoss: 33, cumulativeOutbound: 800, remainingQuota: 2000,
      });
      assert.equal(result.cumulativeInPool - result.totalLoss - result.cumulativeOutbound, 167);
      assert.equal(calculateFarmerLedger({ ...selected, quota: 900 }).remainingQuota, -100);
      assert.deepEqual(calculateFarmerLedger({ ...selected, batches: [], tagClaims: [] }), {
        cumulativeInPool: 0, cumulativeClaimed: 0, cumulativeBound: 0, cumulativeReturned: 0,
        holdingLoss: 0, totalLoss: 0, cumulativeOutbound: 0, remainingQuota: 3000,
      });
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  console.log("✔ 养殖户台账：五类损耗、审核过滤、年度边界、跨年出库及额度结余通过（测试数据已回滚）");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
