import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TagClaimDialog } from "@/components/forms/TagClaimDialog";
import { TagSettleDialog } from "@/components/forms/TagSettleDialog";
import { CheckCircle2, AlertTriangle } from "lucide-react";

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
          <h1 className="text-2xl font-bold tracking-tight">蟹扣领用与日清日结对账</h1>
          <p className="text-sm text-muted-foreground">
            蟹扣为养殖户码（一户一码，不含批次号）。每日领用的蟹扣必须当日完成绑扣出库、退回或作废，逐日轧平。
          </p>
        </div>
        <TagClaimDialog farmers={farmerOptions} userId={defaultUser.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>蟹扣领用申请与轧平台账</CardTitle>
          <CardDescription>
            轧平规则：当日领扣数 = 当日绑扣出库数 + 当日退回数 + 当日作废数。三者必须完全相等方可结单。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>领用日期</TableHead>
                  <TableHead>养殖户</TableHead>
                  <TableHead>申请领扣数</TableHead>
                  <TableHead>绑扣出库数</TableHead>
                  <TableHead>退回数</TableHead>
                  <TableHead>作废数</TableHead>
                  <TableHead>轧平状态</TableHead>
                  <TableHead>审批状态</TableHead>
                  <TableHead className="text-right">日结操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagClaims.map((claim) => (
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
                    <TableCell className="font-mono">{claim.boundCount.toLocaleString()} 只</TableCell>
                    <TableCell className="font-mono">
                      {claim.returnedCount > 0 ? (
                        <span title={claim.returnReason || ""}>{claim.returnedCount} 只</span>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {claim.scrappedCount > 0 ? (
                        <span title={claim.scrapReason || ""}>{claim.scrappedCount} 只</span>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell>
                      {claim.isBalanced ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="size-3 mr-1" />
                          已轧平
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="size-3 mr-1" />
                          未轧平
                        </Badge>
                      )}
                    </TableCell>
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
                    <TableCell className="text-right">
                      {claim.status === "APPROVED" && (
                        <TagSettleDialog claim={claim} userId={defaultUser.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
