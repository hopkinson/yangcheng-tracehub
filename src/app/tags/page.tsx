import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TagClaimDialog } from "@/components/forms/TagClaimDialog";
import { ResubmitTagClaimDialog } from "@/components/forms/ResubmitTagClaimDialog";
import { SettleTagClaimDialog } from "@/components/forms/SettleTagClaimDialog";
import { UnbalancedClaimsBanner } from "@/components/tags/UnbalancedClaimsBanner";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatDate } from "@/lib/utils";
import { TAG_CLAIM_APPROVAL } from "@/config/approval";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const tagClaimInclude = {
    farmer: true,
    applicant: true,
    approver: true,
    bundleBatches: {
      include: {
        sortTasks: {
          include: {
            coldLogs: {
              include: {
                outboundLines: { where: { outboundOrder: { status: { not: "REJECTED" } } } },
                outboundLosses: { where: { status: { not: "REJECTED" } } },
              },
            },
          },
        },
      },
    },
  };

  const [currentUser, totalClaims, tagClaims, farmers, unbalancedClaims] = await Promise.all([
    getCurrentUser(),
    prisma.tagClaim.count(),
    prisma.tagClaim.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: tagClaimInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.farmer.findMany({
      include: {
        batches: true,
        tagClaims: { where: { status: { in: ["APPROVED", "PENDING"] } } },
      },
      where: { status: "ACTIVE" },
    }),
    prisma.tagClaim.findMany({
      where: { status: "APPROVED", isBalanced: false },
      include: tagClaimInclude,
      orderBy: { claimDate: "desc" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  const farmerOptions = farmers.map((f) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    quota: f.quota,
    boundSoFar: f.tagClaims.reduce((sum, c) => sum + c.boundCount, 0),
    tagInboundCount: f.batches.reduce((sum, b) => sum + b.inPoolCount, 0),
    tagClaimedCount: f.tagClaims.reduce((sum, c) => sum + c.claimCount, 0),
    tagReturnedCount: f.tagClaims.reduce((sum, c) => sum + c.returnedCount, 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">蟹扣管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            蟹扣领用审批与日清日结轧平（领用数 = 完成绑扎 + 当日退回 + 当日作废）
          </p>
        </div>
        {isWarehouseOrAdmin && <TagClaimDialog farmers={farmerOptions} userId={currentUserId} />}
      </div>

      {/* 待日结轧平预警看板 (紧凑可折叠收纳) */}
      <UnbalancedClaimsBanner
        claims={unbalancedClaims}
        isWarehouseOrAdmin={isWarehouseOrAdmin}
        currentUserId={currentUserId}
      />

      <Card>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">蟹扣批次 (XK)</TableHead>
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
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      暂无蟹扣领用申请记录
                    </TableCell>
                  </TableRow>
                ) : (
                  tagClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        <div className="flex items-center gap-1">
                          <Tag className="size-3" />
                          <span>{claim.code || "—"}</span>
                        </div>
                      </TableCell>
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
                              : TAG_CLAIM_APPROVAL.pendingLabel}
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
