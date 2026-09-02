import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportLedgerButton } from "@/components/ledgers/ExportLedgerButton";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { QCViewDialog } from "@/components/qc/QCViewDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  Building2,
  Tag,
  Waves,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDate, formatISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ExportLedgerButton filename={exportFilename} headers={exportHeaders} rows={exportRows} />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">{children}</div>
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

const QC_CATEGORY_LABELS: Record<string, string> = {
  QUICK_CHECK: "1. 农残快速检测合格报告 (产地准出)",
  TASTE_CHECK: "2. 品质抽检与试吃记录表",
  WAYBILL: "3. 大闸蟹入库码单",
  POOL_INSPECT: "4. 暂养巡检记录表",
  WATER_QUALITY: "5. 暂养水质监测记录表",
  BUNDLE_INSPECT: "6. 捆扎品质巡检记录表",
  SORT_CALIBRATE: "7. 自动分拣机精度校准记录表",
  SORT_INSPECT: "8. 分拣品质巡检记录表",
  COLD_TEMP: "9. 保鲜库温湿度监控记录表",
  PACK_INSPECT: "10. 装箱打包巡检记录表",
  VEHICLE_INSPECT: "11. 运输车辆卫生与温湿度检查表",
  SHIP_LOG: "12. 成品发货台账",
};

const getContractNo = (f: { code: string; contractName?: string | null }) =>
  f.contractName || `HT-2026-${f.code.replace(/\D/g, "").padStart(3, "0")}`;

export default async function LedgersPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    cat?: string;
    page?: string;
    pageSize?: string;
    qcPage?: string;
    qcPageSize?: string;
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
  const selectedCat = params.cat?.trim();

  const parseP = (val?: string, def = 1) => Math.max(1, Number(val) || def);
  const page = parseP(params.page);
  const pageSize = parseP(params.pageSize, 10);
  const qcPage = parseP(params.qcPage, page);
  const qcPageSize = parseP(params.qcPageSize, pageSize);
  const l1Page = parseP(params.l1Page, page);
  const l1PageSize = parseP(params.l1PageSize, pageSize);
  const l2Page = parseP(params.l2Page, page);
  const l2PageSize = parseP(params.l2PageSize, pageSize);
  const l3Page = parseP(params.l3Page, page);
  const l3PageSize = parseP(params.l3PageSize, pageSize);
  const l4Page = parseP(params.l4Page, page);
  const l4PageSize = parseP(params.l4PageSize, pageSize);

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

  const [farmers, rawTagClaims, batches, outboundOrders, qcRecords] = await Promise.all([
    // 台账一 · 管源头：养殖户主档（不随日期过滤）
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

    // 台账二 · 管身份：蟹扣领用流水（含驳回与申请复核人）
    isChannelViewer
      ? []
      : prisma.tagClaim.findMany({
          where: dateFilter ? { claimDate: dateFilter } : undefined,
          include: {
            farmer: {
              include: {
                batches: true,
                tagClaims: { where: { status: "APPROVED" } },
              },
            },
            applicant: true,
            approver: true,
          },
          orderBy: { claimDate: "desc" },
        }),

    // 台账三 · 管流转：暂养池出入库与损耗流水
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
          include: {
            farmer: true,
            pool: true,
            enclosure: true,
            outboundOrders: {
              where: { status: "APPROVED" },
              include: { store: true },
            },
          },
          orderBy: { inPoolTime: "desc" },
        }),

    // 台账四 · 管去向：出库与订单台账（回溯池/养殖户/围网/物流）
    prisma.outboundOrder.findMany({
      where: {
        ...(isChannelViewer && currentUser?.channelId ? { channelId: currentUser.channelId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        batch: {
          include: {
            farmer: true,
            pool: true,
            enclosure: true,
          },
        },
        store: true,
        channel: true,
        applicant: true,
        approver: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    // 台账五 · 管过程：12类品控记录表
    prisma.qCRecord.findMany({
      where: {
        ...(selectedCat ? { cat: selectedCat } : {}),
        ...(dateFilter ? { checkTime: dateFilter } : {}),
      },
      orderBy: { checkTime: "desc" },
    }),
  ]);

  // 预计算台账二衍生字段
  const tagClaims = rawTagClaims.map((c) => {
    const isRejected = c.status === "REJECTED";
    const liveCount = c.farmer.batches.reduce(
      (sum, b) => sum + Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount),
      0
    );
    const cumClaims = c.farmer.tagClaims.reduce((sum, cl) => sum + cl.claimCount, 0);
    const remainingQuota = Math.max(0, c.farmer.quota - cumClaims);
    return { ...c, isRejected, liveCount, cumClaims, remainingQuota };
  });

  const paginate = <T,>(arr: T[], p: number, s: number) => arr.slice((p - 1) * s, p * s);
  const pagedFarmers = paginate(farmers, l1Page, l1PageSize);
  const pagedTagClaims = paginate(tagClaims, l2Page, l2PageSize);
  const pagedBatches = paginate(batches, l3Page, l3PageSize);
  const pagedOutboundOrders = paginate(outboundOrders, l4Page, l4PageSize);
  const pagedQCRecords = paginate(qcRecords, qcPage, qcPageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCheck className="size-6 text-primary" />
            合规台账（五本账）
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            按「管源头 · 管身份 · 管流转 · 管去向 · 管过程」全链条闭环核销与合规存证
          </p>
        </div>
        <LedgerDateFilter selectedDate={selectedDateStr} />
      </div>

      <Tabs defaultValue="ledger1" className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 max-w-[1080px]">
          <TabsTrigger value="ledger1" className="flex items-center gap-1.5 text-xs">
            <Building2 className="size-3.5" />
            一 · 养殖户与围网 ({farmers.length})
          </TabsTrigger>
          <TabsTrigger value="ledger2" className="flex items-center gap-1.5 text-xs">
            <Tag className="size-3.5" />
            二 · 蟹扣领用 ({tagClaims.length})
          </TabsTrigger>
          <TabsTrigger value="ledger3" className="flex items-center gap-1.5 text-xs">
            <Waves className="size-3.5" />
            三 · 暂养池出入库 ({batches.length})
          </TabsTrigger>
          <TabsTrigger value="ledger4" className="flex items-center gap-1.5 text-xs">
            <Truck className="size-3.5" />
            四 · 出库与订单 ({outboundOrders.length})
          </TabsTrigger>
          <TabsTrigger value="qcLedger" className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" />
            五 · 品控记录表 ({qcRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. 台账一 · 养殖户与围网（管源头） */}
        <TabsContent value="ledger1">
          <LedgerCardSection
            title="台账一 · 养殖户与围网（管源头 · 主档档案）"
            exportFilename="阳澄股份_台账一_养殖户与围网主档"
            exportHeaders={["编号", "姓名", "电话", "类型", "围网", "面积(亩)", "合同号", "信用评级"]}
            exportRows={farmers.map((f) => [
              f.code,
              f.name,
              f.phone,
              f.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
              f.enclosures.map((e) => e.code).join(", ") || "—",
              f.area,
              getContractNo(f),
              f.creditRating || "A",
            ])}
            total={farmers.length}
            page={l1Page}
            pageSize={l1PageSize}
            pageParam="l1Page"
            pageSizeParam="l1PageSize"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">编号</TableHead>
                  <TableHead className="w-[110px]">姓名</TableHead>
                  <TableHead className="w-[130px]">电话</TableHead>
                  <TableHead className="w-[90px]">类型</TableHead>
                  <TableHead className="w-[120px]">围网</TableHead>
                  <TableHead className="w-[100px]">面积</TableHead>
                  <TableHead className="min-w-[150px]">合同号</TableHead>
                  <TableHead className="w-[100px]">信用评级</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      暂无养殖户主档数据
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedFarmers.map((f) => (
                    <TableRow key={f.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono font-medium text-xs">{f.code}</TableCell>
                      <TableCell className="font-medium text-xs">{f.name}</TableCell>
                      <TableCell className="font-mono text-xs">{f.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs py-0">
                          {f.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.enclosures.map((e) => e.code).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f.area} 亩</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {getContractNo(f)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={f.creditRating === "A" ? "default" : "secondary"}
                          className="text-xs py-0 font-mono"
                        >
                          {f.creditRating || "A"} 级
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 2. 台账二 · 蟹扣领用（管身份） */}
        <TabsContent value="ledger2">
          <LedgerCardSection
            title="台账二 · 蟹扣领用（管身份 · 申领与核定余量核销）"
            exportFilename={`阳澄股份_台账二_蟹扣领用_${selectedDateStr || "全量"}`}
            exportHeaders={[
              "日期",
              "XK 号",
              "养殖户",
              "在池存活",
              "申领数",
              "累计领扣",
              "剩余额度",
              "申请人",
              "复核人",
            ]}
            exportRows={tagClaims.map((c) => [
              formatISODate(c.claimDate),
              c.code || "—",
              c.farmer.name,
              c.isRejected ? "—" : c.liveCount,
              c.isRejected ? "—（已驳回）" : c.claimCount,
              c.isRejected ? "—" : c.cumClaims,
              c.isRejected ? "—" : c.remainingQuota,
              c.applicant?.fullName || "—",
              c.isRejected ? "—（已驳回）" : c.approver?.fullName || "—",
            ])}
            total={tagClaims.length}
            page={l2Page}
            pageSize={l2PageSize}
            pageParam="l2Page"
            pageSizeParam="l2PageSize"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">日期</TableHead>
                  <TableHead className="w-[130px]">XK 号</TableHead>
                  <TableHead className="w-[130px]">养殖户</TableHead>
                  <TableHead className="w-[100px]">在池存活</TableHead>
                  <TableHead className="w-[110px]">申领数</TableHead>
                  <TableHead className="w-[100px]">累计领扣</TableHead>
                  <TableHead className="w-[100px]">剩余额度</TableHead>
                  <TableHead className="w-[100px]">申请人</TableHead>
                  <TableHead className="w-[100px]">复核人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无蟹扣领用流水记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTagClaims.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-xs">{formatDate(c.claimDate)}</TableCell>
                      <TableCell className="font-mono font-medium text-xs">
                        {c.code || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{c.farmer.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({c.farmer.code})</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.liveCount.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? (
                          <Badge variant="destructive" className="text-[10px] py-0">
                            —（已驳回）
                          </Badge>
                        ) : (
                          <span className="font-bold text-primary">
                            {c.claimCount.toLocaleString()} 只
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.cumClaims.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.remainingQuota.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.applicant?.fullName || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.isRejected ? (
                          <span className="text-destructive text-xs">已驳回</span>
                        ) : (
                          c.approver?.fullName || "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 3. 台账三 · 暂养池出入库（管流转） */}
        <TabsContent value="ledger3">
          <LedgerCardSection
            title="台账三 · 暂养池出入库（管流转 · 批次入出池与损耗推导）"
            exportFilename={`阳澄股份_台账三_暂养池出入库_${selectedDateStr || "全量"}`}
            exportHeaders={[
              "日期",
              "YL 批次",
              "池编号",
              "养殖户",
              "围网",
              "入池数",
              "出池数",
              "损耗数",
              "出库批次订单",
              "对应门店",
            ]}
            exportRows={batches.map((b) => [
              formatISODate(b.inPoolTime),
              b.code,
              b.pool.code,
              b.farmer.name,
              b.enclosure?.code || "—",
              b.inPoolCount,
              b.outPoolCount,
              b.lossCount,
              b.outboundOrders.map((o) => o.code).join(", ") || "—",
              Array.from(new Set(b.outboundOrders.map((o) => o.store.name))).join(", ") || "—",
            ])}
            total={batches.length}
            page={l3Page}
            pageSize={l3PageSize}
            pageParam="l3Page"
            pageSizeParam="l3PageSize"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">日期</TableHead>
                  <TableHead className="w-[120px]">YL 批次</TableHead>
                  <TableHead className="w-[90px]">池编号</TableHead>
                  <TableHead className="w-[100px]">养殖户</TableHead>
                  <TableHead className="w-[80px]">围网</TableHead>
                  <TableHead className="w-[90px]">入池数</TableHead>
                  <TableHead className="w-[90px]">出池数</TableHead>
                  <TableHead className="w-[90px]">损耗数</TableHead>
                  <TableHead className="min-w-[130px]">出库批次订单</TableHead>
                  <TableHead className="min-w-[140px]">对应门店</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      暂无暂养池出入库记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedBatches.map((b) => {
                    const orderCodes = b.outboundOrders.map((o) => o.code).join(", ");
                    const stores = Array.from(new Set(b.outboundOrders.map((o) => o.store.name))).join(", ");
                    return (
                      <TableRow key={b.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs">{formatDate(b.inPoolTime)}</TableCell>
                        <TableCell className="font-mono font-medium text-xs">{b.code}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Badge variant="outline" className="text-xs font-mono py-0">
                            {b.pool.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{b.farmer.name}</TableCell>
                        <TableCell className="font-mono text-xs">{b.enclosure?.code || "—"}</TableCell>
                        <TableCell className="font-mono text-xs font-medium">{b.inPoolCount} 只</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{b.outPoolCount} 只</TableCell>
                        <TableCell className="font-mono text-xs text-amber-600 dark:text-amber-400">
                          {b.lossCount} 只
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {orderCodes || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {stores ? (
                            <span className="text-foreground">{stores}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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

        {/* 4. 台账四 · 出库与订单（管去向） */}
        <TabsContent value="ledger4">
          <LedgerCardSection
            title="台账四 · 出库与订单（管去向 · 成品核销与物流溯源）"
            exportFilename={`阳澄股份_台账四_出库与订单_${selectedDateStr || "全量"}`}
            exportHeaders={[
              "出库日期",
              "CK 单号",
              "类型",
              "数量",
              "对应池子",
              "养殖户",
              "围网",
              "渠道/门店",
              "物流单号",
              "出库人",
              "复核人",
            ]}
            exportRows={outboundOrders.map((o) => {
              const waybills = o.lines
                .map((l) => l.waybillNo)
                .filter(Boolean)
                .join(", ");
              const logisticsDisplay =
                o.logisticsNo || waybills || (o.lines.length > 0 ? `待回填 ${o.lines.length} 单` : "待回填");
              return [
                formatISODate(o.createdAt),
                o.code,
                o.type === "STORE_ORDER" ? "门店订单" : "提蟹出库",
                o.outboundCount,
                o.batch?.pool?.code || "—",
                o.batch?.farmer?.name || "—",
                o.batch?.enclosure?.code || "—",
                `${o.channel.name} / ${o.store.name}`,
                logisticsDisplay,
                o.applicant?.fullName || "—",
                o.approver?.fullName || "—",
              ];
            })}
            total={outboundOrders.length}
            page={l4Page}
            pageSize={l4PageSize}
            pageParam="l4Page"
            pageSizeParam="l4PageSize"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">出库日期</TableHead>
                  <TableHead className="w-[120px]">CK 单号</TableHead>
                  <TableHead className="w-[90px]">类型</TableHead>
                  <TableHead className="w-[90px]">数量</TableHead>
                  <TableHead className="w-[80px]">对应池子</TableHead>
                  <TableHead className="w-[90px]">养殖户</TableHead>
                  <TableHead className="w-[70px]">围网</TableHead>
                  <TableHead className="min-w-[140px]">渠道 / 门店</TableHead>
                  <TableHead className="min-w-[140px]">物流单号</TableHead>
                  <TableHead className="w-[90px]">出库人</TableHead>
                  <TableHead className="w-[90px]">复核人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outboundOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      暂无出库与订单台账记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOutboundOrders.map((o) => {
                    const waybills = o.lines
                      .map((l) => l.waybillNo)
                      .filter(Boolean)
                      .join(", ");
                    const hasPendingWaybills =
                      !o.logisticsNo && o.lines.some((l) => !l.waybillNo);
                    const logisticsText =
                      o.logisticsNo || waybills || (o.lines.length > 0 ? `待回填 ${o.lines.length} 单` : "待回填");

                    return (
                      <TableRow key={o.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs">{formatDate(o.createdAt)}</TableCell>
                        <TableCell className="font-mono font-medium text-xs">{o.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0">
                            {o.type === "STORE_ORDER" ? "门店订单" : "提蟹出库"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs text-primary">
                          {o.outboundCount.toLocaleString()} 只
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {o.batch?.pool?.code || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{o.batch?.farmer?.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {o.batch?.enclosure?.code || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{o.channel.name}</span>
                          <span className="text-muted-foreground text-[10px] ml-1">· {o.store.name}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {hasPendingWaybills ? (
                            <span className="text-amber-600 dark:text-amber-400 font-sans text-xs">
                              {logisticsText}
                            </span>
                          ) : (
                            <span>{logisticsText}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.applicant?.fullName || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.status === "APPROVED" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {o.approver?.fullName || "已审"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">待审</span>
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

        {/* 5. 台账五 · 品控记录表（管过程） */}
        <TabsContent value="qcLedger">
          <LedgerCardSection
            title="台账五 · 品控记录表（管过程 · 12 类纸质品控电子化留痕与原件存证）"
            exportFilename={`阳澄股份_台账五_品控记录表_${selectedDateStr || "全量"}`}
            exportHeaders={["日期", "记录编号", "类型", "关联对象", "内容", "结果", "上传人"]}
            exportRows={qcRecords.map((q) => [
              q.checkTime.toISOString().slice(5, 16).replace("T", " "),
              q.code,
              QC_CATEGORY_LABELS[q.cat] || q.cat,
              q.refId,
              q.title,
              q.result === "QUALIFIED" ? "合格" : "异常",
              q.uploader,
            ])}
            total={qcRecords.length}
            page={qcPage}
            pageSize={qcPageSize}
            pageParam="qcPage"
            pageSizeParam="qcPageSize"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">日期</TableHead>
                  <TableHead className="w-[130px]">记录编号</TableHead>
                  <TableHead className="min-w-[180px]">类型</TableHead>
                  <TableHead className="w-[120px]">关联对象</TableHead>
                  <TableHead className="min-w-[160px]">内容</TableHead>
                  <TableHead className="w-[90px]">结果</TableHead>
                  <TableHead className="w-[90px]">上传人</TableHead>
                  <TableHead className="text-right w-[80px]">附件</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qcRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      暂无品控留痕记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedQCRecords.map((q) => {
                    const isException = q.result === "EXCEPTION";
                    return (
                      <TableRow key={q.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs">
                          {q.checkTime.toISOString().slice(5, 16).replace("T", " ")}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-xs">{q.code}</TableCell>
                        <TableCell className="text-xs">
                          {QC_CATEGORY_LABELS[q.cat] || q.cat}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{q.refId}</TableCell>
                        <TableCell className="text-xs font-medium">{q.title}</TableCell>
                        <TableCell>
                          {isException ? (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              <AlertTriangle className="size-3 mr-0.5" /> 异常
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                              <CheckCircle2 className="size-3 mr-0.5" /> 合格
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{q.uploader}</TableCell>
                        <TableCell className="text-right">
                          <QCViewDialog record={q} triggerText="查阅" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
