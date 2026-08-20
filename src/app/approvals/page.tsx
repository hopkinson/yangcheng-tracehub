import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagApprovalButton, OutboundApprovalButton } from "@/components/forms/ApprovalActions";
import { CheckSquare, Tag, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [tagClaims, outboundOrders, qaUser] = await Promise.all([
    prisma.tagClaim.findMany({
      include: {
        farmer: {
          include: {
            batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
            tagClaims: { where: { status: "APPROVED" } },
          },
        },
        applicant: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outboundOrder.findMany({
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
        applicant: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findFirstOrThrow({ where: { role: "QA_DIRECTOR" } }),
  ]);

  const pendingTagClaims = tagClaims.filter((c) => c.status === "PENDING");
  const pendingOutbound = outboundOrders.filter((o) => o.status === "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">品控主管风控与审批中心</h1>
        <p className="text-sm text-muted-foreground">
          品控职责：严把大闸蟹供应链出厂大门，复核蟹扣领用额度与出库单在池存活，拦截超发超卖，确保数据留痕可审计。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待审核蟹扣领用申请</CardTitle>
            <Tag className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTagClaims.length} 笔</div>
            <p className="text-xs text-muted-foreground">校验名下在池存活与年度剩余额度</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待审核出库发货单</CardTitle>
            <Truck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOutbound.length} 笔</div>
            <p className="text-xs text-muted-foreground">强校验批次在池存活与渠道订单一致性</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tags" className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="size-3.5" />
            蟹扣领用审批 ({pendingTagClaims.length})
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex items-center gap-2">
            <Truck className="size-3.5" />
            出库审批 ({pendingOutbound.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <Card>
            <CardHeader>
              <CardTitle>待审核蟹扣领用申请列表</CardTitle>
              <CardDescription>
                通过后仓库可领扣并打包；驳回需必填驳回意见。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>申请日期</TableHead>
                      <TableHead>来源养殖户</TableHead>
                      <TableHead>申请领用数量</TableHead>
                      <TableHead>名下在池存活合计</TableHead>
                      <TableHead>年度剩余额度</TableHead>
                      <TableHead>申请人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">品控审批操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagClaims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                          暂无蟹扣领用记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      tagClaims.map((claim) => {
                        const activeInPool = claim.farmer.batches.reduce(
                          (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
                          0
                        );
                        const cumulativeClaimed = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
                        const remainingQuota = Math.max(0, claim.farmer.quota - cumulativeClaimed);

                        return (
                          <TableRow key={claim.id}>
                            <TableCell className="font-mono text-xs">
                              {new Date(claim.claimDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {claim.farmer.name} ({claim.farmer.code})
                            </TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {claim.claimCount.toLocaleString()} 只
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-emerald-600">
                              {activeInPool.toLocaleString()} 只
                            </TableCell>
                            <TableCell className="font-mono">{remainingQuota.toLocaleString()} 只</TableCell>
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
                                  ? "已通过"
                                  : claim.status === "REJECTED"
                                  ? "已驳回"
                                  : "待审批"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {claim.status === "PENDING" ? (
                                <TagApprovalButton claimId={claim.id} qaUserId={qaUser.id} />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {claim.approvalComment || "已处理"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound">
          <Card>
            <CardHeader>
              <CardTitle>待审核出库单列表</CardTitle>
              <CardDescription>
                审批通过执行批次在池数量扣减；若超发在池存活将自动拦截。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>出库单号</TableHead>
                      <TableHead>来源批次</TableHead>
                      <TableHead>养殖户</TableHead>
                      <TableHead>出库数量</TableHead>
                      <TableHead>批次在池存活</TableHead>
                      <TableHead>目标门店</TableHead>
                      <TableHead>申请人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">品控审批操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outboundOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                          暂无出库单记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      outboundOrders.map((order) => {
                        const liveInBatch =
                          order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;

                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-medium">{order.code}</TableCell>
                            <TableCell className="font-mono text-xs">{order.batch.code}</TableCell>
                            <TableCell>{order.batch.farmer.name}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {order.outboundCount.toLocaleString()} 只
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-emerald-600">
                              {liveInBatch.toLocaleString()} 只
                            </TableCell>
                            <TableCell>{order.store.name}</TableCell>
                            <TableCell className="text-muted-foreground">{order.applicant.fullName}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  order.status === "APPROVED"
                                    ? "default"
                                    : order.status === "REJECTED"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {order.status === "APPROVED"
                                  ? "已通过"
                                  : order.status === "REJECTED"
                                  ? "已驳回"
                                  : "待审批"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {order.status === "PENDING" ? (
                                <OutboundApprovalButton orderId={order.id} qaUserId={qaUser.id} />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {order.approvalComment || order.rejectReason || "已处理"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
