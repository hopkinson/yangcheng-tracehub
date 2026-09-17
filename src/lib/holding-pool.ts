import type { Prisma } from "@prisma/client";
import { Invariants } from "@/lib/invariants";

export function summarizeBatchItems(items: Array<{ inPoolCount: number; outPoolCount: number; lossCount: number }>) {
  const inPoolCount = items.reduce((sum, item) => sum + item.inPoolCount, 0);
  const outPoolCount = items.reduce((sum, item) => sum + item.outPoolCount, 0);
  const lossCount = items.reduce((sum, item) => sum + item.lossCount, 0);
  const remaining = Math.max(0, inPoolCount - outPoolCount - lossCount);
  return { inPoolCount, outPoolCount, lossCount, remaining };
}

export async function releasePoolSpecLockIfEmpty(
  tx: Prisma.TransactionClient,
  poolId: string
) {
  const pool = await tx.holdingPool.findUniqueOrThrow({
    where: { id: poolId },
    include: {
      batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
      batchItems: { where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
    },
  });

  if (Invariants.calculatePoolLiveCount(pool) > 0) return;

  await tx.holdingPool.update({
    where: { id: poolId },
    data: { currentGender: null, currentWeightTier: null },
  });
}
