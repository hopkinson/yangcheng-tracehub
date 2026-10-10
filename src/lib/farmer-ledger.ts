import type { Prisma, PrismaClient } from "@prisma/client";
import { Invariants } from "./invariants";
import { getBeijingYear } from "./utils";

export const farmerLedgerSelect = {
  id: true,
  code: true,
  name: true,
  year: true,
  farmType: true,
  area: true,
  quota: true,
  creditRating: true,
  status: true,
  contractUrl: true,
  contractName: true,
  enclosures: { select: { code: true } },
  tagClaims: {
    where: { status: "APPROVED" },
    select: { claimDate: true, claimCount: true, returnedCount: true },
  },
  batches: {
    select: {
      inPoolTime: true,
      inPoolCount: true,
      lossCount: true,
      bundleBatches: {
        where: { status: "COMPLETED" },
        select: {
          status: true,
          qualifiedCount: true,
          lossCount: true,
          sortTasks: {
            where: { status: "COMPLETED" },
            select: {
              status: true,
              lossCount: true,
              coldLogs: {
                select: {
                  outboundLines: {
                    where: { outboundOrder: { status: "APPROVED" } },
                    select: { count: true },
                  },
                  outboundLosses: {
                    where: { status: "APPROVED" },
                    select: { count: true, lossType: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.FarmerSelect;

export async function getFarmerLedgerRows(db: Pick<PrismaClient, "farmer">, ids: string[]) {
  const farmers = await db.farmer.findMany({ where: { id: { in: ids } }, select: { id: true, year: true } });
  const years = [...new Set(farmers.map((farmer) => farmer.year))];
  const groups = await Promise.all(years.map((year) => {
    const range = { gte: new Date(`${year}-01-01T00:00:00+08:00`), lt: new Date(`${year + 1}-01-01T00:00:00+08:00`) };
    return db.farmer.findMany({
      where: { id: { in: farmers.filter((farmer) => farmer.year === year).map((farmer) => farmer.id) } },
      select: {
        ...farmerLedgerSelect,
        batches: { ...farmerLedgerSelect.batches, where: { inPoolTime: range } },
        tagClaims: { ...farmerLedgerSelect.tagClaims, where: { ...farmerLedgerSelect.tagClaims.where, claimDate: range } },
      },
    });
  }));
  return groups.flat();
}

// 输入来自 farmerLedgerSelect：加工只取已完成，出库及损耗只取已审核记录。
export function calculateFarmerLedger(farmer: Prisma.FarmerGetPayload<{ select: typeof farmerLedgerSelect }>) {
  let cumulativeInPool = 0;
  let cumulativeBound = 0;
  let holdingLoss = 0;
  let totalLoss = 0;
  let cumulativeOutbound = 0;
  for (const batch of farmer.batches) {
    if (getBeijingYear(batch.inPoolTime) !== farmer.year) continue;
    cumulativeInPool += batch.inPoolCount;
    const loss = Invariants.calculateBatchLifecycleLoss(batch);
    holdingLoss += loss.holdingLoss;
    totalLoss += loss.totalLoss;
    for (const bundle of batch.bundleBatches) {
      cumulativeBound += bundle.qualifiedCount;
      for (const task of bundle.sortTasks) {
        for (const coldLog of task.coldLogs) {
          for (const line of coldLog.outboundLines) cumulativeOutbound += line.count;
        }
      }
    }
  }
  let cumulativeClaimed = 0;
  let cumulativeReturned = 0;
  for (const claim of farmer.tagClaims) {
    if (getBeijingYear(claim.claimDate) !== farmer.year) continue;
    cumulativeClaimed += claim.claimCount;
    cumulativeReturned += claim.returnedCount;
  }
  return {
    cumulativeInPool,
    cumulativeClaimed,
    cumulativeBound,
    cumulativeReturned,
    holdingLoss,
    totalLoss,
    cumulativeOutbound,
    remainingQuota: farmer.quota - cumulativeInPool,
  };
}
