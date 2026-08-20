import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportLedgerButton } from "@/components/ledgers/ExportLedgerButton";
import { Users, Tag, Waves, Truck, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LedgersPage() {
  const [farmers, tagClaims, batches, outboundOrders] = await Promise.all([
    prisma.farmer.findMany({
      include: { enclosures: true, batches: true },
      orderBy: { code: "asc" },
    }),
    prisma.tagClaim.findMany({
      include: { farmer: true },
      orderBy: { claimDate: "desc" },
    }),
    prisma.batch.findMany({
      include: { farmer: true, pool: true, enclosure: true },
      orderBy: { inPoolTime: "desc" },
    }),
    prisma.outboundOrder.findMany({
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: true,
        channel: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // 台账一数据
  const ledger1Headers = [
    "养殖户编号",
    "养殖户名称",
    "联系方式",
    "养殖类型",
    "围网编号",
    "养殖面积(亩)",
    "核定额度(只)",
    "当年累计入池(只)",
    "信用等级",
    "合作状态",
  ];
  const ledger1Rows = farmers.map((f) => [
    f.code,
    f.name,
    f.phone,
    f.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
    f.enclosures.map((e) => e.code).join("; "),
    f.area,
    f.quota,
    f.batches.reduce((sum, b) => sum + b.inPoolCount, 0),
    f.creditRating,
    f.status === "ACTIVE" ? "正常" : "暂停",
  ]);

  // 台账二数据
  const ledger2Headers = [
    "日期",
    "养殖户编号",
    "养殖户名称",
    "申请领扣数量(只)",
    "绑扣出库数量(只)",
    "退回数量(只)",
    "退回原因",
    "作废数量(只)",
    "作废原因",
    "轧平状态",
  ];
  const ledger2Rows = tagClaims.map((c) => [
    new Date(c.claimDate).toISOString().slice(0, 10),
    c.farmer.code,
    c.farmer.name,
    c.claimCount,
    c.boundCount,
    c.returnedCount,
    c.returnReason || "-",
    c.scrappedCount,
    c.scrapReason || "-",
    c.isBalanced ? "已轧平" : "未轧平",
  ]);

  // 台账三数据
  const ledger3Headers = [
    "入池日期",
    "批次编号",
    "暂养池编号",
    "养殖户名称",
    "公母",
    "规格档位",
    "初始入池数(只)",
    "已出池数(只)",
    "累计损耗数(只)",
    "当前账面在池(只)",
  ];
  const ledger3Rows = batches.map((b) => [
    new Date(b.inPoolTime).toISOString().slice(0, 10),
    b.code,
    b.pool.code,
    b.farmer.name,
    b.gender === "MALE" ? "公蟹" : "母蟹",
    b.weightTier,
    b.inPoolCount,
    b.outPoolCount,
    b.lossCount,
    b.inPoolCount - b.outPoolCount - b.lossCount,
  ]);

  // 台账四数据
  const ledger4Headers = [
    "出库日期",
    "出库单号",
    "关联原料批次",
    "来源养殖户",
    "发往门店",
    "所属渠道",
    "出库发货数(只)",
    "渠道订单数(只)",
    "物流单号",
    "审核状态",
  ];
  const ledger4Rows = outboundOrders.map((o) => [
    new Date(o.createdAt).toISOString().slice(0, 10),
    o.code,
    o.batch.code,
    o.batch.farmer.name,
    o.store.name,
    o.channel.name,
    o.outboundCount,
    o.channelOrderCount,
    o.logisticsNo || "待生成",
    o.status === "APPROVED" ? "已出库" : o.status === "REJECTED" ? "已驳回" : "待审批",
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">企业供应链与渠道审核四大合规台账</h1>
        <p className="text-sm text-muted-foreground">
          根据品控管理体系要求输出四本标准台账，以数字化流水证明带扣大闸蟹出厂总量与源头产量守恒。支持一键导出 CSV/Excel。
        </p>
      </div>

      <Tabs defaultValue="ledger1" className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 max-w-[800px]">
          <TabsTrigger value="ledger1" className="flex items-center gap-1.5 text-xs">
            <Users className="size-3.5" />
            台账一·养殖户与围网
          </TabsTrigger>
          <TabsTrigger value="ledger2" className="flex items-center gap-1.5 text-xs">
            <Tag className="size-3.5" />
            台账二·蟹扣领用对账
          </TabsTrigger>
          <TabsTrigger value="ledger3" className="flex items-center gap-1.5 text-xs">
            <Waves className="size-3.5" />
            台账三·暂养池出入库
          </TabsTrigger>
          <TabsTrigger value="ledger4" className="flex items-center gap-1.5 text-xs">
            <Truck className="size-3.5" />
            台账四·出库与订单
          </TabsTrigger>
        </TabsList>

        {/* 台账一: 养殖户与围网台账 */}
        <TabsContent value="ledger1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>台账一 · 养殖户与围网主档台账</CardTitle>
                <CardDescription>
                  全量展示签约养殖主体、养殖面积、核定额度（600只/亩）及信用评级。
                </CardDescription>
              </div>
              <ExportLedgerButton
                filename="阳澄股份_台账一_养殖户与围网台账"
                headers={ledger1Headers}
                rows={ledger1Rows}
              />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>养殖户编号</TableHead>
                      <TableHead>养殖户名称</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead>养殖类型</TableHead>
                      <TableHead>围网编号</TableHead>
                      <TableHead>养殖面积</TableHead>
                      <TableHead>核定额度</TableHead>
                      <TableHead>当年累计入池</TableHead>
                      <TableHead>信用等级</TableHead>
                      <TableHead>合作状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farmers.map((f) => {
                      const inPool = f.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono font-medium">{f.code}</TableCell>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell className="text-muted-foreground">{f.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{f.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {f.enclosures.map((e) => e.code).join(", ")}
                          </TableCell>
                          <TableCell className="font-mono">{f.area} 亩</TableCell>
                          <TableCell className="font-mono font-bold text-primary">
                            {f.quota.toLocaleString()} 只
                          </TableCell>
                          <TableCell className="font-mono">{inPool.toLocaleString()} 只</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{f.creditRating} 级</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{f.status === "ACTIVE" ? "正常" : "暂停"}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 台账二: 蟹扣领用台账 */}
        <TabsContent value="ledger2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>台账二 · 蟹扣领用与日结轧平台账</CardTitle>
                <CardDescription>
                  展示每日领用数量、绑扣出库数、退回数、作废数与轧平闭环状态。
                </CardDescription>
              </div>
              <ExportLedgerButton
                filename="阳澄股份_台账二_蟹扣领用与日结轧平台账"
                headers={ledger2Headers}
                rows={ledger2Rows}
              />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>养殖户</TableHead>
                      <TableHead>领用数量</TableHead>
                      <TableHead>绑扣出库数</TableHead>
                      <TableHead>退回数</TableHead>
                      <TableHead>作废数</TableHead>
                      <TableHead>轧平状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagClaims.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(c.claimDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {c.farmer.name} ({c.farmer.code})
                        </TableCell>
                        <TableCell className="font-mono font-bold">{c.claimCount.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono">{c.boundCount.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono">
                          {c.returnedCount > 0 ? (
                            <span title={c.returnReason || ""}>{c.returnedCount} 只</span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {c.scrappedCount > 0 ? (
                            <span title={c.scrapReason || ""}>{c.scrappedCount} 只</span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell>
                          {c.isBalanced ? (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 台账三: 暂养池出入库台账 */}
        <TabsContent value="ledger3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>台账三 · 暂养池出入库与损耗台账</CardTitle>
                <CardDescription>
                  记录各池批次流动：入池数、出池数、损耗数及账面在池存活。
                </CardDescription>
              </div>
              <ExportLedgerButton
                filename="阳澄股份_台账三_暂养池出入库与损耗台账"
                headers={ledger3Headers}
                rows={ledger3Rows}
              />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>入池日期</TableHead>
                      <TableHead>批次号</TableHead>
                      <TableHead>暂养池</TableHead>
                      <TableHead>养殖户</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>入池数</TableHead>
                      <TableHead>出池数</TableHead>
                      <TableHead>损耗数</TableHead>
                      <TableHead>账面在池</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => {
                      const live = b.inPoolCount - b.outPoolCount - b.lossCount;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(b.inPoolTime).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono font-medium">{b.code}</TableCell>
                          <TableCell className="font-mono">{b.pool.code}</TableCell>
                          <TableCell>{b.farmer.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {b.gender === "MALE" ? "公" : "母"} · {b.weightTier}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-medium">{b.inPoolCount} 只</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{b.outPoolCount} 只</TableCell>
                          <TableCell className="font-mono">{b.lossCount} 只</TableCell>
                          <TableCell className="font-mono font-bold text-emerald-600">{live} 只</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 台账四: 出库与订单台账 */}
        <TabsContent value="ledger4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>台账四 · 出库与销售订单台账</CardTitle>
                <CardDescription>
                  记录发货单号、对应批次、门店全称、所属渠道、订单数、出库数及物流单号。
                </CardDescription>
              </div>
              <ExportLedgerButton
                filename="阳澄股份_台账四_出库与销售订单台账"
                headers={ledger4Headers}
                rows={ledger4Rows}
              />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>出库日期</TableHead>
                      <TableHead>出库单号</TableHead>
                      <TableHead>批次编号</TableHead>
                      <TableHead>养殖户</TableHead>
                      <TableHead>发往门店</TableHead>
                      <TableHead>所属渠道</TableHead>
                      <TableHead>出库数量</TableHead>
                      <TableHead>订单数量</TableHead>
                      <TableHead>物流单号</TableHead>
                      <TableHead>审核状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outboundOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{o.code}</TableCell>
                        <TableCell className="font-mono text-xs">{o.batch.code}</TableCell>
                        <TableCell>{o.batch.farmer.name}</TableCell>
                        <TableCell>{o.store.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.channel.name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary">
                          {o.outboundCount.toLocaleString()} 只
                        </TableCell>
                        <TableCell className="font-mono">{o.channelOrderCount.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono text-xs">{o.logisticsNo || "待生成"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              o.status === "APPROVED"
                                ? "default"
                                : o.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {o.status === "APPROVED" ? "已出库" : o.status === "REJECTED" ? "已驳回" : "待审"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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
