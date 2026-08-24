import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportLedgerButton } from "@/components/ledgers/ExportLedgerButton";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Users, Tag, Waves, Truck, CheckCircle2, AlertTriangle, FileSpreadsheet, CheckCheck } from "lucide-react";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDate, formatISODate, formatISOMonth } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 通用台账卡片容器组件，避免各 Tab 样板代码重复
function LedgerCardSection({
  title,
  exportFilename,
  exportHeaders,
  exportRows,
  children,
  total,
  page,
  pageSize,
  pageParam,
  pageSizeParam,
}: {
  title: string;
  exportFilename: string;
  exportHeaders: string[];
  exportRows: (string | number)[][];
  children: React.ReactNode;
  total: number;
  page: number;
  pageSize: number;
  pageParam: string;
  pageSizeParam: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        <ExportLedgerButton filename={exportFilename} headers={exportHeaders} rows={exportRows} />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">{children}</div>
        <DataTablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          pageParam={pageParam}
          pageSizeParam={pageSizeParam}
        />
      </CardContent>
    </Card>
  );
}

export default async function LedgersPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    l1Page?: string;
    l1PageSize?: string;
    l2Page?: string;
    l2PageSize?: string;
    l3Page?: string;
    l3PageSize?: string;
    l4Page?: string;
    l4PageSize?: string;
  }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const selectedDateStr = params.date?.trim();

  const l1Page = Math.max(1, Number(params.l1Page) || 1);
  const l1PageSize = Math.max(1, Number(params.l1PageSize) || 10);
  const l2Page = Math.max(1, Number(params.l2Page) || 1);
  const l2PageSize = Math.max(1, Number(params.l2PageSize) || 10);
  const l3Page = Math.max(1, Number(params.l3Page) || 1);
  const l3PageSize = Math.max(1, Number(params.l3PageSize) || 10);
  const l4Page = Math.max(1, Number(params.l4Page) || 1);
  const l4PageSize = Math.max(1, Number(params.l4PageSize) || 10);

  let dateFilter: { gte: Date; lte: Date } | undefined = undefined;
  if (selectedDateStr) {
    try {
      const parsed = parseISO(selectedDateStr);
      dateFilter = {
        gte: startOfDay(parsed),
        lte: endOfDay(parsed),
      };
    } catch {}
  }

  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";

  const [farmers, tagClaims, batches, outboundOrders, allApprovedOutbound] = await Promise.all([
    // 台账一为主档，展示全量（渠道用户不展示商业主档）
    isChannelViewer
      ? []
      : prisma.farmer.findMany({
          include: {
            enclosures: true,
            batches: true,
            tagClaims: { where: { status: "APPROVED" } },
          },
          orderBy: { code: "asc" },
        }),
    // 台账二：仅统计审核通过的蟹扣领用，按天过滤
    isChannelViewer
      ? []
      : prisma.tagClaim.findMany({
          where: {
            status: "APPROVED",
            ...(dateFilter ? { claimDate: dateFilter } : {}),
          },
          include: { farmer: true },
          orderBy: { claimDate: "desc" },
        }),
    // 台账三：暂养池入池/损耗/出池按天过滤
    isChannelViewer
      ? []
      : prisma.batch.findMany({
          where: dateFilter
            ? {
                OR: [
                  { inPoolTime: dateFilter },
                  { lossRecords: { some: { inventoryDate: dateFilter } } },
                  { outboundOrders: { some: { createdAt: dateFilter, status: "APPROVED" } } },
                ],
              }
            : undefined,
          include: { farmer: true, pool: true, enclosure: true },
          orderBy: { inPoolTime: "desc" },
        }),
    // 台账四：出库发货按天过滤（渠道用户严格隔离本渠道）
    prisma.outboundOrder.findMany({
      where: {
        ...(isChannelViewer && currentUser?.channelId ? { channelId: currentUser.channelId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: true,
        channel: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // 月度全量已审核出库（用于渠道月报分发统计）
    prisma.outboundOrder.findMany({
      where: {
        status: "APPROVED",
        ...(isChannelViewer && currentUser?.channelId ? { channelId: currentUser.channelId } : {}),
      },
      include: {
        store: true,
        channel: true,
      },
    }),
  ]);

  // 台账二：按【日期 + 养殖户】聚合汇总，满足按户按日轧平
  const aggregatedMap = new Map<string, {
    id: string;
    dateStr: string;
    claimDate: Date;
    farmer: (typeof tagClaims)[0]["farmer"];
    claimCount: number;
    boundCount: number;
    returnedCount: number;
    returnReasons: string[];
    scrappedCount: number;
    scrapReasons: string[];
    isBalanced: boolean;
  }>();

  for (const c of tagClaims) {
    const dateStr = formatISODate(c.claimDate);
    const key = `${dateStr}_${c.farmerId}`;
    const row = aggregatedMap.get(key) || {
      id: key,
      dateStr,
      claimDate: c.claimDate,
      farmer: c.farmer,
      claimCount: 0,
      boundCount: 0,
      returnedCount: 0,
      returnReasons: [],
      scrappedCount: 0,
      scrapReasons: [],
      isBalanced: true,
    };
    row.claimCount += c.claimCount;
    row.boundCount += c.boundCount;
    row.returnedCount += c.returnedCount;
    if (c.returnReason) row.returnReasons.push(c.returnReason);
    row.scrappedCount += c.scrappedCount;
    if (c.scrapReason) row.scrapReasons.push(c.scrapReason);
    row.isBalanced = row.claimCount === row.boundCount + row.returnedCount + row.scrappedCount;
    aggregatedMap.set(key, row);
  }
  const aggregatedTagClaims = Array.from(aggregatedMap.values());

  const paginate = <T,>(arr: T[], p: number, s: number) => arr.slice((p - 1) * s, p * s);
  const pagedFarmers = paginate(farmers, l1Page, l1PageSize);
  const pagedTagClaims = paginate(aggregatedTagClaims, l2Page, l2PageSize);
  const pagedBatches = paginate(batches, l3Page, l3PageSize);
  const pagedOutboundOrders = paginate(outboundOrders, l4Page, l4PageSize);

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

  // 台账二数据 (按户按日聚合)
  const ledger2Headers = [
    "日期",
    "养殖户编号",
    "养殖户名称",
    "当日领扣数量(只)",
    "当日绑扣出库(只)",
    "当日退回数量(只)",
    "退回原因",
    "当日作废数量(只)",
    "作废原因",
    "轧平状态",
  ];
  const ledger2Rows = aggregatedTagClaims.map((c) => [
    c.dateStr,
    c.farmer.code,
    c.farmer.name,
    c.claimCount,
    c.boundCount,
    c.returnedCount,
    c.returnReasons.join("; ") || "-",
    c.scrappedCount,
    c.scrapReasons.join("; ") || "-",
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
    "检测报告",
  ];
  const ledger3Rows = batches.map((b) => [
    formatISODate(b.inPoolTime),
    b.code,
    b.pool.code,
    b.farmer.name,
    b.gender === "MALE" ? "公蟹" : "母蟹",
    b.weightTier,
    b.inPoolCount,
    b.outPoolCount,
    b.lossCount,
    b.inPoolCount - b.outPoolCount - b.lossCount,
    b.reportUrl ? b.reportName || "已上传" : "未上传",
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
    formatISODate(o.createdAt),
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

  // 月度全链路追溯与品控对账月报汇总
  const currentMonthStr = selectedDateStr ? selectedDateStr.slice(0, 7) : formatISOMonth();

  const farmerMonthlySummaries = farmers.map((f) => {
    const inPool = f.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
    const outPool = f.batches.reduce((sum, b) => sum + b.outPoolCount, 0);
    const loss = f.batches.reduce((sum, b) => sum + b.lossCount, 0);
    const live = inPool - outPool - loss;
    const claimed = f.tagClaims.reduce((sum, c) => sum + c.claimCount, 0);
    const bound = f.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
    const returned = f.tagClaims.reduce((sum, c) => sum + c.returnedCount, 0);
    const scrapped = f.tagClaims.reduce((sum, c) => sum + c.scrappedCount, 0);
    const usageRate = f.quota > 0 ? ((inPool / f.quota) * 100).toFixed(1) : "0.0";
    const isBalanced = claimed === bound + returned + scrapped;
    const isQuotaValid = inPool <= f.quota;

    return {
      farmer: f,
      inPool,
      outPool,
      loss,
      live,
      claimed,
      bound,
      returned,
      scrapped,
      usageRate,
      isBalanced,
      isQuotaValid,
    };
  });

  const kpiTotalQuota = farmers.reduce((sum, f) => sum + f.quota, 0);
  const kpiTotalInPool = farmerMonthlySummaries.reduce((sum, s) => sum + s.inPool, 0);
  const kpiTotalClaimed = farmerMonthlySummaries.reduce((sum, s) => sum + s.claimed, 0);
  const kpiTotalOutbound = allApprovedOutbound.reduce((sum, o) => sum + o.outboundCount, 0);
  const kpiTotalLoss = farmerMonthlySummaries.reduce((sum, s) => sum + s.loss, 0);
  const kpiLossRate = kpiTotalInPool > 0 ? ((kpiTotalLoss / kpiTotalInPool) * 100).toFixed(2) : "0.00";
  const allBalanced = farmerMonthlySummaries.every((s) => s.isBalanced);
  const allQuotaValid = farmerMonthlySummaries.every((s) => s.isQuotaValid);

  const channelMap = new Map<string, { name: string; storeNames: Set<string>; orderCount: number; totalCount: number }>();
  for (const o of allApprovedOutbound) {
    const cId = o.channelId;
    const item = channelMap.get(cId) || { name: o.channel.name, storeNames: new Set<string>(), orderCount: 0, totalCount: 0 };
    item.storeNames.add(o.store.name);
    item.orderCount += 1;
    item.totalCount += o.outboundCount;
    channelMap.set(cId, item);
  }
  const channelSummaries = Array.from(channelMap.values());

  const monthlyHeaders = [
    "养殖户编号",
    "养殖户名称",
    "养殖类型",
    "签约面积(亩)",
    "核定额度(只)",
    "累计入池(只)",
    "额度使用率",
    "累计领扣(只)",
    "已出库发货(只)",
    "在池存活(只)",
    "日结轧平状态",
    "额度合规结论",
  ];
  const monthlyRows = farmerMonthlySummaries.map((s) => [
    s.farmer.code,
    s.farmer.name,
    s.farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
    s.farmer.area,
    s.farmer.quota,
    s.inPool,
    `${s.usageRate}%`,
    s.claimed,
    s.bound,
    s.live,
    s.isBalanced ? "已轧平" : "未轧平",
    s.isQuotaValid ? "合规 (未超额)" : "超额预警",
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">合规台账</h1>
          <p className="text-xs text-muted-foreground">养殖户、蟹扣、暂养与出库台账及月度追溯报告</p>
        </div>
        <LedgerDateFilter selectedDate={selectedDateStr} />
      </div>

      <Tabs defaultValue="ledger1" className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 max-w-[960px]">
          <TabsTrigger value="ledger1" className="flex items-center gap-1.5 text-xs">
            <Users className="size-3.5" />
            台账一·养殖户
          </TabsTrigger>
          <TabsTrigger value="ledger2" className="flex items-center gap-1.5 text-xs">
            <Tag className="size-3.5" />
            台账二·蟹扣 {dateFilter && `(${aggregatedTagClaims.length})`}
          </TabsTrigger>
          <TabsTrigger value="ledger3" className="flex items-center gap-1.5 text-xs">
            <Waves className="size-3.5" />
            台账三·暂养池 {dateFilter && `(${batches.length})`}
          </TabsTrigger>
          <TabsTrigger value="ledger4" className="flex items-center gap-1.5 text-xs">
            <Truck className="size-3.5" />
            台账四·出库单 {dateFilter && `(${outboundOrders.length})`}
          </TabsTrigger>
          <TabsTrigger value="monthlyReport" className="flex items-center gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" />
            月度追溯月报
          </TabsTrigger>
        </TabsList>

        {/* 台账一: 养殖户与围网台账 */}
        <TabsContent value="ledger1">
          <LedgerCardSection
            title="台账一 · 养殖户与围网台账"
            exportFilename="阳澄股份_台账一_养殖户与围网台账"
            exportHeaders={ledger1Headers}
            exportRows={ledger1Rows}
            total={farmers.length}
            page={l1Page}
            pageSize={l1PageSize}
            pageParam="l1Page"
            pageSizeParam="l1PageSize"
          >
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
                {pagedFarmers.map((f) => {
                  const inPool = f.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono font-medium">{f.code}</TableCell>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-muted-foreground">{f.phone || "-"}</TableCell>
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
          </LedgerCardSection>
        </TabsContent>

        {/* 台账二: 蟹扣领用台账 */}
        <TabsContent value="ledger2">
          <LedgerCardSection
            title="台账二 · 蟹扣领用与日结轧平台账"
            exportFilename={`阳澄股份_台账二_蟹扣领用台账_${selectedDateStr || "全量"}`}
            exportHeaders={ledger2Headers}
            exportRows={ledger2Rows}
            total={aggregatedTagClaims.length}
            page={l2Page}
            pageSize={l2PageSize}
            pageParam="l2Page"
            pageSizeParam="l2PageSize"
          >
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
                {aggregatedTagClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      {selectedDateStr ? `未查询到 ${selectedDateStr} 当日的蟹扣领用记录` : "暂无蟹扣领用记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTagClaims.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(c.claimDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.farmer.name} ({c.farmer.code})
                      </TableCell>
                      <TableCell className="font-mono font-bold">{c.claimCount.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono">{c.boundCount.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono">
                        {c.returnedCount > 0 ? (
                          <span title={c.returnReasons.join("; ") || ""}>{c.returnedCount} 只</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {c.scrappedCount > 0 ? (
                          <span title={c.scrapReasons.join("; ") || ""}>{c.scrappedCount} 只</span>
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
                  ))
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 台账三: 暂养池出入库台账 */}
        <TabsContent value="ledger3">
          <LedgerCardSection
            title="台账三 · 暂养池出入库与损耗台账"
            exportFilename={`阳澄股份_台账三_暂养池出入库台账_${selectedDateStr || "全量"}`}
            exportHeaders={ledger3Headers}
            exportRows={ledger3Rows}
            total={batches.length}
            page={l3Page}
            pageSize={l3PageSize}
            pageParam="l3Page"
            pageSizeParam="l3PageSize"
          >
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
                  <TableHead>检测报告</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                      {selectedDateStr ? `未查询到 ${selectedDateStr} 当日的暂养池出入库记录` : "暂无批次记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedBatches.map((b) => {
                    const live = b.inPoolCount - b.outPoolCount - b.lossCount;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">
                          {formatDate(b.inPoolTime)}
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
                        <TableCell>
                          {b.reportUrl ? (
                            <BatchReportViewDialog
                              batchCode={b.code}
                              reportName={b.reportName || "检测报告"}
                              reportUrl={b.reportUrl}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">未上传</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 台账四: 出库与订单台账 */}
        <TabsContent value="ledger4">
          <LedgerCardSection
            title="台账四 · 出库与销售订单台账"
            exportFilename={`阳澄股份_台账四_出库与销售订单台账_${selectedDateStr || "全量"}`}
            exportHeaders={ledger4Headers}
            exportRows={ledger4Rows}
            total={outboundOrders.length}
            page={l4Page}
            pageSize={l4PageSize}
            pageParam="l4Page"
            pageSizeParam="l4PageSize"
          >
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
                {outboundOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                      {selectedDateStr ? `未查询到 ${selectedDateStr} 当日的出库发货记录` : "暂无出库单记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOutboundOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(o.createdAt)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 月度追溯月报: 全链路追溯与合规审核月报 */}
        <TabsContent value="monthlyReport" className="space-y-6">
          {/* KPI 关键指标卡 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground">年度核定总额度</span>
              <div className="text-xl font-bold font-mono text-primary mt-1">
                {kpiTotalQuota.toLocaleString()} <span className="text-xs font-normal">只</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground">累计入池总量</span>
              <div className="text-xl font-bold font-mono mt-1">
                {kpiTotalInPool.toLocaleString()} <span className="text-xs font-normal">只</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground">累计领扣总量</span>
              <div className="text-xl font-bold font-mono mt-1">
                {kpiTotalClaimed.toLocaleString()} <span className="text-xs font-normal">只</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground">已出库发货总量</span>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {kpiTotalOutbound.toLocaleString()} <span className="text-xs font-normal">只</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground">综合损耗率 / 轧平结论</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono">{kpiLossRate}%</span>
                {allBalanced && allQuotaValid ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                    <CheckCircle2 className="size-3 mr-0.5" /> 严格轧平
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] py-0">
                    <AlertTriangle className="size-3 mr-0.5" /> 存在异常
                  </Badge>
                )}
              </div>
            </Card>
          </div>

          {/* 养殖户月度数量闭环对账 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>各签约养殖户数量闭环对账明细</CardTitle>
              <ExportLedgerButton
                filename={`阳澄股份_月度全链路追溯月报_${currentMonthStr}`}
                headers={monthlyHeaders}
                rows={monthlyRows}
                label="导出月度追溯报告 (CSV/Excel)"
              />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>养殖户</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>面积/额度</TableHead>
                      <TableHead>累计入池</TableHead>
                      <TableHead>额度使用率</TableHead>
                      <TableHead>累计领扣</TableHead>
                      <TableHead>已出库</TableHead>
                      <TableHead>在池存活</TableHead>
                      <TableHead>日结轧平</TableHead>
                      <TableHead>额度合规</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farmerMonthlySummaries.map((s) => (
                      <TableRow key={s.farmer.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{s.farmer.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{s.farmer.code}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {s.farmer.area} 亩 / {s.farmer.quota.toLocaleString()} 只
                        </TableCell>
                        <TableCell className="font-mono">{s.inPool.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono font-medium">{s.usageRate}%</TableCell>
                        <TableCell className="font-mono">{s.claimed.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono font-bold text-primary">{s.bound.toLocaleString()} 只</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-600">{s.live.toLocaleString()} 只</TableCell>
                        <TableCell>
                          {s.isBalanced ? (
                            <span className="text-xs text-emerald-600 flex items-center font-medium">
                              <CheckCheck className="size-3.5 mr-0.5" /> 已轧平
                            </span>
                          ) : (
                            <span className="text-xs text-destructive flex items-center font-medium">
                              <AlertTriangle className="size-3.5 mr-0.5" /> 未轧平
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.isQuotaValid ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">
                              合规
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              超额拦截
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

          {/* 渠道月度发货分发 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">渠道发货分发表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>销售渠道</TableHead>
                      <TableHead>覆盖门店</TableHead>
                      <TableHead>出库单数</TableHead>
                      <TableHead>出库总数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                          暂无已审批渠道出库记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      channelSummaries.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="font-mono text-xs">{c.storeNames.size} 家门店</TableCell>
                          <TableCell className="font-mono text-xs">{c.orderCount} 单</TableCell>
                          <TableCell className="font-mono font-bold text-primary">{c.totalCount.toLocaleString()} 只</TableCell>
                        </TableRow>
                      ))
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

