import { formatDate } from "./utils";

type Claim = {
  farmerId: string;
  claimDate: Date;
  claimCount: number;
  returnedCount: number;
  scrappedCount: number;
  status: string;
  bundleBatches: { status: string; doneAt: Date | null; qualifiedCount: number }[];
};

export function getTagClaimLedgerHeaders(showReturns: boolean) {
  return ["申领日期", "申领时间", "蟹扣批次", "蟹扣养殖户", "当日蟹扣入仓数", "当日申领数", "当日完成绑扎", "其中-已出库", ...(showReturns ? ["当日退回"] : []), "当日作废", "当日差额", "轧平校验", "累计绑扎", "剩余额度", "申请人", "复核人", "审批时间", "审核状态", "入仓校验"];
}

export function calculateTagClaimLedger(
  farmers: { id: string; batches: { inPoolTime: Date; inPoolCount: number }[] }[],
  claims: Claim[],
) {
  const key = (farmerId: string, date: Date) => `${farmerId}:${formatDate(date)}`;
  const inbound = new Map<string, number>();
  const claimed = new Map<string, number>();
  for (const farmer of farmers) {
    for (const batch of farmer.batches) {
      const day = key(farmer.id, batch.inPoolTime);
      inbound.set(day, (inbound.get(day) || 0) + batch.inPoolCount);
    }
  }
  for (const claim of claims) {
    if (claim.status === "REJECTED") continue;
    const day = key(claim.farmerId, claim.claimDate);
    claimed.set(day, (claimed.get(day) || 0) + claim.claimCount);
  }
  return claims.map((claim) => {
    const day = key(claim.farmerId, claim.claimDate);
    const rejected = claim.status === "REJECTED";
    const dailyInbound = rejected ? 0 : inbound.get(day) || 0;
    const dailyClaimed = rejected ? 0 : claimed.get(day) || 0;
    const dailyBound = rejected ? 0 : claim.bundleBatches.reduce((sum, batch) =>
      sum + (batch.status === "COMPLETED" && batch.doneAt && formatDate(batch.doneAt) === formatDate(claim.claimDate)
        ? batch.qualifiedCount : 0), 0);
    // 退废沿用申领日的日结归属；历史退回必须参与守恒，不能并入作废。
    const difference = rejected ? 0 : claim.claimCount - dailyBound - claim.returnedCount - claim.scrappedCount;
    return {
      dailyInbound, dailyClaimed, dailyBound, difference,
      balanceStatus: rejected ? "已驳回" : difference === 0 ? "已轧平" : "未轧平",
      inboundStatus: rejected ? "已驳回" : dailyClaimed > dailyInbound ? "当日申领超过当日入仓" : "正常",
    };
  });
}
