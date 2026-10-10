import assert from "node:assert/strict";
import { calculateTagClaimLedger, getTagClaimLedgerHeaders } from "../src/lib/tag-claim-ledger";

const claimDate = new Date("2026-10-08T16:00:00Z"); // 北京时间 10 月 9 日
const bundle = (doneAt: string | null, qualifiedCount: number, status = "COMPLETED") => ({
  doneAt: doneAt ? new Date(doneAt) : null, qualifiedCount, status,
});
const claim = {
  farmerId: "a", claimDate, claimCount: 60, returnedCount: 0, scrappedCount: 5, status: "APPROVED",
  bundleBatches: [
    bundle("2026-10-08T16:00:00Z", 30),
    bundle("2026-10-09T15:59:59Z", 25),
    bundle("2026-10-09T16:00:00Z", 10), // 次日完成不得回填
    bundle(null, 100),
    bundle("2026-10-09T10:00:00Z", 100, "BUNDLING"),
  ],
};
const farmers = [{ id: "a", batches: [
  { inPoolTime: new Date("2026-10-08T15:59:59Z"), inPoolCount: 999 },
  { inPoolTime: claimDate, inPoolCount: 40 },
  { inPoolTime: new Date("2026-10-09T15:59:59Z"), inPoolCount: 60 },
  { inPoolTime: new Date("2026-10-09T16:00:00Z"), inPoolCount: 999 },
] }];
const claims = [claim, { ...claim, claimCount: 50, status: "PENDING", bundleBatches: [] },
  { ...claim, claimCount: 999, status: "REJECTED" },
  { ...claim, farmerId: "b", claimCount: 3, scrappedCount: 0, bundleBatches: [] },
  { ...claim, claimDate: new Date("2026-10-09T16:00:00Z"), claimCount: 4, bundleBatches: [] }];
const result = calculateTagClaimLedger(farmers, claims);
assert.equal(result[0].dailyInbound, 100, "仅统计北京时间当日入池");
assert.equal(result[0].dailyClaimed, 110, "多笔累加，包含占用额度的待审核申领，排除驳回");
assert.equal(result[0].inboundStatus, "当日申领超过当日入仓");
assert.equal(result[0].dailyBound, 55, "只统计申领日实际完成的合格数");
assert.equal(result[0].difference, 0);
assert.equal(result[0].balanceStatus, "已轧平");
assert.equal(result[1].difference, 45);
assert.equal(result[1].balanceStatus, "未轧平");
assert.equal(result[2].dailyInbound, 0);
assert.equal(result[2].dailyBound, 0);
assert.equal(result[2].difference, 0);
assert.equal(result[2].balanceStatus, "已驳回");
assert.equal(result[3].dailyInbound, 0, "不同养殖户隔离，无入仓按零处理");
assert.equal(result[3].dailyClaimed, 3);
assert.equal(result[4].dailyClaimed, 4, "不同日期隔离");
const returned = calculateTagClaimLedger(farmers, [{ ...claim, claimCount: 65, returnedCount: 5 }])[0];
assert.equal(returned.difference, 0, "历史退回参与守恒");
const crossDay = calculateTagClaimLedger(farmers, [{ ...claim, claimCount: 70 }])[0];
assert.equal(crossDay.difference, 10, "跨日完成不掩盖申领当天的差额");
assert.equal(crossDay.balanceStatus, "未轧平");
for (const showReturns of [false, true]) {
  const headers = getTagClaimLedgerHeaders(showReturns);
  assert.equal(headers.includes("其中-后道损耗"), false);
  assert.equal(headers.includes("当日退回"), showReturns);
  assert.equal(headers[4], "当日蟹扣入仓数");
  assert.equal(headers[5], "当日申领数");
  assert.equal(headers[6], "当日完成绑扎");
  assert.equal(headers[showReturns ? 10 : 9], "当日差额");
  assert.equal(headers.length, showReturns ? 19 : 18);
}
console.log("✓ 蟹扣日报：日期边界、多笔申领、跨日绑扎、历史退回、驳回及导出表头通过");
