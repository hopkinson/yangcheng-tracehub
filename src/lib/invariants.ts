/**
 * 阳澄股份大闸蟹溯源系统 - 五大数量守恒与卡控纯函数引擎
 */

export interface FarmerQuotaCheck {
  annualQuota: number;
  cumulativeInPool: number;
  newBatchCount: number;
}

export interface TagClaimCheck {
  farmerQuota: number;
  cumulativeClaimed: number;
  activeInPoolCount: number;
  requestedCount: number;
}

export interface LossCalculation {
  bookInPool: number;
  physicalCount: number;
  inPoolCount: number;
  historicalLoss: number;
}

export interface OutboundCheck {
  bookInPool: number;
  outboundCount: number;
  channelOrderCount: number;
}

export interface DailyTagBalanceCheck {
  claimedCount: number;
  boundCount: number;
  returnedCount: number;
  scrappedCount: number;
}

export const Invariants = {
  // 1. 额度校验: 面积 * 600 只/亩
  calculateQuota: (areaInMu: number): number => Math.floor(areaInMu * 600),

  // 校验入池是否超额
  checkQuota: ({ annualQuota, cumulativeInPool, newBatchCount }: FarmerQuotaCheck) => {
    const isExceeded = cumulativeInPool + newBatchCount > annualQuota;
    return {
      valid: !isExceeded,
      remainingQuota: Math.max(0, annualQuota - cumulativeInPool),
      excess: isExceeded ? cumulativeInPool + newBatchCount - annualQuota : 0,
    };
  },

  // 2. 暂养池规格复用校验: 同公母同重量档位可复用，空池自动绑定，异规格禁止混池
  checkPoolSpec: (
    pool: { currentGender: string | null; currentWeightTier: string | null; activeCount?: number },
    target: { gender: string; weightTier: string }
  ) => {
    if (!pool.currentGender || pool.activeCount === 0) {
      return { valid: true, requiresBinding: true, reason: "空池，允许入池并锁定规格" };
    }
    const match = pool.currentGender === target.gender && pool.currentWeightTier === target.weightTier;
    return {
      valid: match,
      requiresBinding: false,
      reason: match
        ? "在养规格匹配，允许复用入池"
        : `规格冲突: 池内为【${pool.currentGender} / ${pool.currentWeightTier}】，待入池为【${target.gender} / ${target.weightTier}】`,
    };
  },

  // 3. 蟹扣领用余量计算与校验: min(在池存活合计, 剩余额度)
  checkTagClaim: ({ farmerQuota, cumulativeClaimed, activeInPoolCount, requestedCount }: TagClaimCheck) => {
    const remainingQuota = Math.max(0, farmerQuota - cumulativeClaimed);
    const maxClaimable = Math.min(activeInPoolCount, remainingQuota);
    const valid = requestedCount > 0 && requestedCount <= maxClaimable;
    return {
      valid,
      maxClaimable,
      activeInPoolCount,
      remainingQuota,
      reason: valid ? "领用数量在合规余量范围内" : `超领拦截: 申请 ${requestedCount} 只，当前可领上限为 ${maxClaimable} 只`,
    };
  },

  // 4. 盘点损耗计算与 5% 阈值告警
  calculateLoss: ({ bookInPool, physicalCount, inPoolCount, historicalLoss }: LossCalculation) => {
    if (physicalCount > bookInPool) {
      return {
        valid: false,
        lossDelta: 0,
        totalLoss: 0,
        lossRate: 0,
        isException: true,
        reason: "实盘数量大于账面在池，请核查盘点数量",
      };
    }
    const lossDelta = bookInPool - physicalCount;
    const totalLoss = historicalLoss + lossDelta;
    const lossRate = inPoolCount > 0 ? Number(((totalLoss / inPoolCount) * 100).toFixed(2)) : 0;
    const isException = lossRate > 5.0;

    return {
      valid: true,
      lossDelta,
      totalLoss,
      lossRate,
      isException,
      reason: isException ? `累计损耗率已达 ${lossRate}%（超 5%），请填写损耗原因` : "损耗登记正常",
    };
  },

  // 5. 单票出库校验: 在池存活校验 + 订单一致性
  checkOutbound: ({ bookInPool, outboundCount, channelOrderCount }: OutboundCheck) => {
    if (outboundCount <= 0) return { valid: false, reason: "出库数量必须大于0" };
    if (outboundCount > bookInPool) {
      return { valid: false, reason: `在池存活不足: 申请出库 ${outboundCount} 只，当前批次在池仅剩 ${bookInPool} 只` };
    }
    if (outboundCount !== channelOrderCount) {
      return { valid: false, reason: `出库数量 (${outboundCount}) 与渠道订单数量 (${channelOrderCount}) 不一致` };
    }
    return { valid: true, remainingInPool: bookInPool - outboundCount, reason: "出库校验通过" };
  },

  // 6. 蟹扣逐日轧平对账: 领扣 = 绑扣 + 退回 + 作废
  checkDailyBalance: ({ claimedCount, boundCount, returnedCount, scrappedCount }: DailyTagBalanceCheck) => {
    const accounted = boundCount + returnedCount + scrappedCount;
    const diff = claimedCount - accounted;
    const isBalanced = diff === 0;
    return {
      isBalanced,
      diff,
      reason: isBalanced
        ? "当日蟹扣数量已轧平"
        : `数量未轧平: 当日领扣 ${claimedCount} 只，已核销 ${accounted} 只（绑扣 ${boundCount} + 退回 ${returnedCount} + 作废 ${scrappedCount}），差额 ${diff} 只`,
    };
  },
};
