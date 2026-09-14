import type { Prisma } from "@prisma/client";
import { Invariants } from "@/lib/invariants";

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
