import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TagClaimDialog } from "@/components/forms/TagClaimDialog";
import { ResubmitTagClaimDialog } from "@/components/forms/ResubmitTagClaimDialog";
import { SettleTagClaimDialog } from "@/components/forms/SettleTagClaimDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [currentUser, totalClaims, tagClaims, farmers, unbalancedClaims] = await Promise.all([
    getCurrentUser(),
    prisma.tagClaim.count(),
    prisma.tagClaim.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        farmer: true,
        applicant: true,
        approver: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.farmer.findMany({
      include: {
        batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        tagClaims: { where: { status: "APPROVED" } },
      },
      where: { status: "ACTIVE" },
    }),
    prisma.tagClaim.findMany({
      where: { status: "APPROVED", isBalanced: false },
      include: {
        farmer: true,
        applicant: true,
        approver: true,
      },
      orderBy: { claimDate: "desc" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  const farmerOptions = farmers.map((f) => {
    const activeInPool = f.batches.reduce(
      (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
      0
    );
    const claimedSoFar = f.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
    return {
      id: f.id,
      name: f.name,
      code: f.code,
      quota: f.quota,
      activeInPool,
      claimedSoFar,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">蟹扣管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            蟹扣领用审批与日清日结轧平（领用数 = 绑扣出库 + 当日退回 + 当日作废）
          </p>
        </div>
        {isWarehouseOrAdmin && <TagClaimDialog farmers={farmerOptions} userId={currentUserId} />}
      </div>

      {/* 待日结轧平预警看板 */}
      {unbalancedClaims.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-sm">
                ⚠️
              </span>
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  蟹扣日结待轧平预警
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 text-[10px]">
                    {unbalancedClaims.length} 笔未轧平
                  </Badge>
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  系统硬约束：若前日存在未轧平领扣记录，次日将阻断该养殖户的新领扣申请，请及时核销退废。
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unbalancedClaims.map((claim) => {
              const accounted = (claim.boundCount || 0) + (claim.returnedCount || 0) + (claim.scrappedCount || 0);
              const diff = claim.claimCount - accounted;
              return (
                <div key={claim.id} className="flex items-center justify-between rounded-lg bg-background/80 p-2.5 border border-amber-500/20 text-xs">
                  <div className="flex flex-col">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      {claim.farmer.name}
                      <span className="font-mono text-[10px] text-muted-foreground">({formatDate(claim.claimDate)})</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      领用: <span className="font-mono font-medium">{claim.claimCount}</span> · 已核销: <span className="font-mono text-emerald-600">{accounted}</span> · 差额: <span className="font-mono font-bold text-destructive">{diff} 只</span>
                    </div>
                  </div>
                  {isWarehouseOrAdmin && (
                    <SettleTagClaimDialog claim={claim} userId={currentUserId} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>领用日期</TableHead>
                  <TableHead>来源养殖户</TableHead>
                  <TableHead>申请领扣数</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>审批状态</TableHead>
                  <TableHead>审批人 / 意见</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      暂无蟹扣领用申请记录
                    </TableCell>
                  </TableRow>
                ) : (
                  tagClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(claim.claimDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{claim.farmer.name}</span>
                          <span className="text-xs font-mono text-muted-foreground">{claim.farmer.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">
                        {claim.claimCount.toLocaleString()} 只
                      </TableCell>
                      <TableCell className="text-muted-foreground">{claim.applicant.fullName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={
                              claim.status === "APPROVED"
                                ? "default"
                                : claim.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {claim.status === "APPROVED"
                              ? "审批通过"
                              : claim.status === "REJECTED"
                              ? "已驳回"
                              : "待品控审核"}
                          </Badge>
                          {claim.status === "APPROVED" && (
                            claim.isBalanced ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                                ✓ 已轧平
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px] px-1.5 py-0 h-4">
                                待日结轧平
                              </Badge>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {claim.approver ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{claim.approver.fullName}</span>
                            {claim.approvalComment && <span>{claim.approvalComment}</span>}
                          </div>
                        ) : (
                          "待审批"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {claim.status === "APPROVED" && isWarehouseOrAdmin && (
                          <SettleTagClaimDialog claim={claim} userId={currentUserId} />
                        )}
                        {claim.status === "REJECTED" && isWarehouseOrAdmin && (
                          <ResubmitTagClaimDialog claim={claim} userId={currentUserId} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination total={totalClaims} page={page} pageSize={pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
