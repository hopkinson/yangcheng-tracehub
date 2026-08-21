import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TagClaimDialog } from "@/components/forms/TagClaimDialog";
import { ResubmitTagClaimDialog } from "@/components/forms/ResubmitTagClaimDialog";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const [tagClaims, farmers, defaultUser] = await Promise.all([
    prisma.tagClaim.findMany({
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
    prisma.user.findFirstOrThrow({ where: { role: "WAREHOUSE_ADMIN" } }),
  ]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">蟹扣领用申请管理</h1>
          <p className="text-sm text-muted-foreground">
            蟹扣为养殖户码（一户一码，不含批次号）。前台发起领用申请与查看审批记录；日清日结由后台自动对账并在台账中归集。
          </p>
        </div>
        <TagClaimDialog farmers={farmerOptions} userId={defaultUser.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>蟹扣领用申请与审批记录</CardTitle>
          <CardDescription>
            仓库管理员发起领用，系统根据养殖户名下在池存活及年度剩余额度校验可领余量，品控主管审批后方可领用。
          </CardDescription>
        </CardHeader>
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
                        {new Date(claim.claimDate).toLocaleDateString()}
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
                        {claim.status === "REJECTED" && (
                          <ResubmitTagClaimDialog claim={claim} userId={defaultUser.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
