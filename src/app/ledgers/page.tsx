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
  Layers3,
  Scale,
  ThermometerSnowflake,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDate, formatDateTime, formatShortDateTime, formatISODate } from "@/lib/utils";

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
  QUICK_CHECK: "1. 原料兽药农残快检",
  TASTE_CHECK: "2. 品质抽检与试吃记录",
  WAYBILL: "3. 大闸蟹入库码单",
  POOL_INSPECT: "4. 暂养巡检记录",
  WATER_QUALITY: "5. 暂养水质监测记录",
  BUNDLE_INSPECT: "6. 捆扎作业巡检记录",
  SORT_CALIBRATE: "7. 分拣设备精度校验记录",
  SORT_INSPECT: "8. 分拣作业巡检记录",
  COLD_TEMP: "9. 保鲜库信息记录表",
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
    l5Page?: string;
    l5PageSize?: string;
    l6Page?: string;
    l6PageSize?: string;
    l7Page?: string;
    l7PageSize?: string;
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
  const l5Page = parseP(params.l5Page, page);
  const l5PageSize = parseP(params.l5PageSize, pageSize);
  const l6Page = parseP(params.l6Page, page);
  const l6PageSize = parseP(params.l6PageSize, pageSize);
  const l7Page = parseP(params.l7Page, page);
  const l7PageSize = parseP(params.l7PageSize, pageSize);

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

  const [farmers, rawTagClaims, batches, bundleBatches, sortTasks, coldLogs, outboundOrders, qcRecords] = await Promise.all([
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
            bundleBatches: { include: { group: true } },
            outboundOrders: {
              where: { status: "APPROVED" },
              include: { store: true },
            },
          },
          orderBy: { inPoolTime: "desc" },
        }),

    // 台账四 · 捆扎作业
    isChannelViewer
      ? []
      : prisma.bundleBatch.findMany({
          where: dateFilter ? { date: dateFilter } : undefined,
          include: {
            group: true,
            tagClaim: { include: { farmer: true } },
            sourceBatch: true,
            lines: { include: { pool: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),

    // 台账五 · 分拣作业
    isChannelViewer
      ? []
      : prisma.sortTask.findMany({
          where: dateFilter ? { date: dateFilter } : undefined,
          include: {
            machine: true,
            bundleBatch: { include: { sourceBatch: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),

    // 台账六 · 保鲜预冷库存
    isChannelViewer
      ? []
      : prisma.coldLog.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          include: {
            store: true,
            sortTask: {
              include: { bundleBatch: { include: { sourceBatch: true } } },
            },
            outboundLines: {
              where: { outboundOrder: { status: { not: "REJECTED" } } },
            },
            outboundLosses: true,
          },
          orderBy: { createdAt: "desc" },
        }),

    // 台账七 · 管去向：出库与订单台账（回溯完整生产链与物流）
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
        lines: {
          include: {
            coldLog: {
              include: {
                sortTask: { include: { bundleBatch: { include: { sourceBatch: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 台账八 · 管过程：12类品控记录表
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
    const cumulativeBound = c.farmer.tagClaims.reduce((sum, cl) => sum + cl.boundCount, 0);
    const remainingQuota = Math.max(0, c.farmer.quota - cumulativeBound);
    const balanceDiff = c.claimCount - c.boundCount - c.returnedCount - c.scrappedCount;
    return { ...c, isRejected, cumulativeBound, remainingQuota, balanceDiff };
  });

  const paginate = <T,>(arr: T[], p: number, s: number) => arr.slice((p - 1) * s, p * s);
  const pagedFarmers = paginate(farmers, l1Page, l1PageSize);
  const pagedTagClaims = paginate(tagClaims, l2Page, l2PageSize);
  const pagedBatches = paginate(batches, l3Page, l3PageSize);
  const pagedBundleBatches = paginate(bundleBatches, l4Page, l4PageSize);
  const pagedSortTasks = paginate(sortTasks, l5Page, l5PageSize);
  const pagedColdLogs = paginate(coldLogs, l6Page, l6PageSize);
  const pagedOutboundOrders = paginate(outboundOrders, l7Page, l7PageSize);
  const pagedQCRecords = paginate(qcRecords, qcPage, qcPageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCheck className="size-6 text-primary" />
            合规台账（八本账）
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            按「源头 · 身份 · 暂养 · 捆扎 · 分拣 · 预冷 · 去向 · 品控」全链条闭环核销与合规存证
          </p>
        </div>
        <LedgerDateFilter selectedDate={selectedDateStr} />
      </div>

        <Tabs defaultValue="ledger1" className="flex flex-col gap-4">
          <div className="w-full overflow-x-auto">
          <TabsList className="grid min-w-[1280px] grid-cols-8">
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
            <Layers3 className="size-3.5" />
            四 · 捆扎作业 ({bundleBatches.length})
          </TabsTrigger>
          <TabsTrigger value="ledger5" className="flex items-center gap-1.5 text-xs">
            <Scale className="size-3.5" />
            五 · 分拣作业 ({sortTasks.length})
          </TabsTrigger>
          <TabsTrigger value="ledger6" className="flex items-center gap-1.5 text-xs">
            <ThermometerSnowflake className="size-3.5" />
            六 · 保鲜预冷 ({coldLogs.length})
          </TabsTrigger>
          <TabsTrigger value="ledger7" className="flex items-center gap-1.5 text-xs">
            <Truck className="size-3.5" />
            七 · 出库与订单 ({outboundOrders.length})
          </TabsTrigger>
          <TabsTrigger value="qcLedger" className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" />
            八 · 品控记录表 ({qcRecords.length})
          </TabsTrigger>
        </TabsList>
          </div>

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
            title="台账二 · 蟹扣领用（管身份 · 申领、完成绑扎与日结轧平）"
            exportFilename={`阳澄股份_台账二_蟹扣领用_${selectedDateStr || "全量"}`}
            exportHeaders={[
              "日期",
              "XK 号",
              "养殖户",
              "申领数",
              "完成绑扎",
              "退回",
              "作废",
              "差额",
              "轧平状态",
              "累计绑扎",
              "剩余额度",
              "申请人",
              "复核人",
            ]}
            exportRows={tagClaims.map((c) => [
              formatISODate(c.claimDate),
              c.code || "—",
              c.farmer.name,
              c.isRejected ? "—（已驳回）" : c.claimCount,
              c.isRejected ? "—" : c.boundCount,
              c.isRejected ? "—" : c.returnedCount,
              c.isRejected ? "—" : c.scrappedCount,
              c.isRejected ? "—" : c.balanceDiff,
              c.isRejected ? "已驳回" : c.isBalanced ? "已轧平" : "未轧平",
              c.isRejected ? "—" : c.cumulativeBound,
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
            <Table className="min-w-[1500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">日期</TableHead>
                  <TableHead className="w-[130px]">XK 号</TableHead>
                  <TableHead className="w-[130px]">养殖户</TableHead>
                  <TableHead className="w-[110px]">申领数</TableHead>
                  <TableHead className="w-[100px]">完成绑扎</TableHead>
                  <TableHead className="w-[80px]">退回</TableHead>
                  <TableHead className="w-[80px]">作废</TableHead>
                  <TableHead className="w-[80px]">差额</TableHead>
                  <TableHead className="w-[100px]">轧平状态</TableHead>
                  <TableHead className="w-[100px]">累计绑扎</TableHead>
                  <TableHead className="w-[100px]">剩余额度</TableHead>
                  <TableHead className="w-[100px]">申请人</TableHead>
                  <TableHead className="w-[100px]">复核人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
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
                        {c.isRejected ? "—" : `${c.boundCount.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.returnedCount.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.scrappedCount.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.balanceDiff.toLocaleString()} 只`}
                      </TableCell>
                      <TableCell>
                        {c.isRejected ? (
                          <Badge variant="destructive" className="text-[10px] py-0">已驳回</Badge>
                        ) : c.isBalanced ? (
                          <Badge variant="outline" className="text-[10px] py-0">已轧平</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] py-0">未轧平</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.isRejected ? "—" : `${c.cumulativeBound.toLocaleString()} 只`}
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
          {(() => {
            const getBatchFlow = (b: any) => {
              const kzd = Array.from(new Set(b.bundleBatches?.map((batch: any) => batch.code).filter(Boolean)));
              const grp = Array.from(new Set(b.bundleBatches?.map((batch: any) => batch.group?.name).filter(Boolean)));
              return {
                dest: kzd.length > 0 ? kzd.join(", ") : (b.outboundOrders?.map((o: any) => o.code).join(", ") || "—"),
                target: grp.length > 0 ? grp.join(", ") : (Array.from(new Set(b.outboundOrders?.map((o: any) => o.store?.name))).join(", ") || "—"),
              };
            };
            return (
              <LedgerCardSection
                title="台账三 · 暂养池出入库（管流转 · 批次入出池与损耗推导）"
                exportFilename={`阳澄股份_台账三_暂养池出入库_${selectedDateStr || "全量"}`}
                exportHeaders={[
                  "日期",
                  "YL 批次",
                  "暂养池",
                  "养殖户",
                  "围网",
                  "入池数",
                  "出池数",
                  "损耗数",
                  "出池去向(捆扎批次)",
                  "作业班组/去向",
                ]}
                exportRows={batches.map((b) => {
                  const flow = getBatchFlow(b);
                  return [
                    formatISODate(b.inPoolTime),
                    b.code,
                    b.pool.name ? `${b.pool.name} (${b.pool.code})` : b.pool.code,
                    b.farmer.name,
                    b.enclosure?.code || "—",
                    b.inPoolCount,
                    b.outPoolCount,
                    b.lossCount,
                    flow.dest,
                    flow.target,
                  ];
                })}
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
                      <TableHead className="w-[150px]">暂养池</TableHead>
                      <TableHead className="w-[100px]">养殖户</TableHead>
                      <TableHead className="w-[80px]">围网</TableHead>
                      <TableHead className="w-[90px]">入池数</TableHead>
                      <TableHead className="w-[90px]">出池数</TableHead>
                      <TableHead className="w-[90px]">损耗数</TableHead>
                      <TableHead className="min-w-[130px]">出池去向 (捆扎批次)</TableHead>
                      <TableHead className="min-w-[140px]">作业班组 / 去向</TableHead>
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
                        const flow = getBatchFlow(b);
                        return (
                          <TableRow key={b.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-mono text-xs">{formatDate(b.inPoolTime)}</TableCell>
                            <TableCell className="font-mono font-medium text-xs">{b.code}</TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{b.pool.name || b.pool.code}</div>
                              {b.pool.name && <div className="font-mono text-[10px] text-muted-foreground">{b.pool.code}</div>}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{b.farmer.name}</TableCell>
                            <TableCell className="font-mono text-xs">{b.enclosure?.code || "—"}</TableCell>
                            <TableCell className="font-mono text-xs font-medium">{b.inPoolCount} 只</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{b.outPoolCount} 只</TableCell>
                            <TableCell className="font-mono text-xs text-amber-600 dark:text-amber-400">
                              {b.lossCount} 只
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {flow.dest}
                            </TableCell>
                            <TableCell className="text-xs">
                              {flow.target !== "—" ? (
                                <span className="text-foreground">{flow.target}</span>
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
            );
          })()}
        </TabsContent>

        {/* 4. 台账四 · 捆扎作业 */}
        <TabsContent value="ledger4">
          <LedgerCardSection
            title="台账四 · 捆扎作业（投入、合格、损耗与蟹扣核销）"
            exportFilename={`阳澄股份_台账四_捆扎作业_${selectedDateStr || "全量"}`}
            exportHeaders={["日期", "KZD 批次", "YL 批次", "XK 号", "养殖户", "班组", "蟹绳批次", "投入数", "合格数", "损耗数", "状态"]}
            exportRows={bundleBatches.map((b) => [
              formatISODate(b.date),
              b.code,
              b.sourceBatch.code,
              b.tagClaim.code || "—",
              b.tagClaim.farmer.name,
              b.group.name,
              b.ropeBatch,
              b.inputCount || b.lines.reduce((sum, line) => sum + line.count, 0),
              b.status === "COMPLETED" ? b.qualifiedCount : "—",
              b.status === "COMPLETED" ? b.lossCount : "—",
              b.status === "COMPLETED" ? "已完成" : "捆扎中",
            ])}
            total={bundleBatches.length}
            page={l4Page}
            pageSize={l4PageSize}
            pageParam="l4Page"
            pageSizeParam="l4PageSize"
          >
            <Table className="min-w-[1250px]">
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>KZD 批次</TableHead>
                  <TableHead>YL 批次</TableHead>
                  <TableHead>XK 号</TableHead>
                  <TableHead>养殖户</TableHead>
                  <TableHead>班组</TableHead>
                  <TableHead>蟹绳批次</TableHead>
                  <TableHead>投入数</TableHead>
                  <TableHead>合格数</TableHead>
                  <TableHead>损耗数</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedBundleBatches.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">暂无捆扎作业记录</TableCell></TableRow>
                ) : pagedBundleBatches.map((b) => {
                  const inputCount = b.inputCount || b.lines.reduce((sum, line) => sum + line.count, 0);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{formatDate(b.date)}</TableCell>
                      <TableCell className="font-mono font-medium text-xs">{b.code}</TableCell>
                      <TableCell className="font-mono text-xs">{b.sourceBatch.code}</TableCell>
                      <TableCell className="font-mono text-xs">{b.tagClaim.code || "—"}</TableCell>
                      <TableCell className="text-xs">{b.tagClaim.farmer.name}</TableCell>
                      <TableCell className="text-xs">{b.group.name}</TableCell>
                      <TableCell className="font-mono text-xs">{b.ropeBatch}</TableCell>
                      <TableCell className="font-mono text-xs">{inputCount.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono text-xs">{b.status === "COMPLETED" ? `${b.qualifiedCount.toLocaleString()} 只` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{b.status === "COMPLETED" ? `${b.lossCount.toLocaleString()} 只` : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] py-0">{b.status === "COMPLETED" ? "已完成" : "捆扎中"}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 5. 台账五 · 分拣作业 */}
        <TabsContent value="ledger5">
          <LedgerCardSection
            title="台账五 · 分拣作业（规格、合格数与损耗核算）"
            exportFilename={`阳澄股份_台账五_分拣作业_${selectedDateStr || "全量"}`}
            exportHeaders={["日期", "FJR 任务", "KZD 批次", "YL 批次", "设备", "规格", "投入数", "合格数", "损耗数", "损耗率", "状态"]}
            exportRows={sortTasks.map((t) => [
              formatISODate(t.date),
              t.code,
              t.bundleBatch.code,
              t.bundleBatch.sourceBatch.code,
              t.machine.code,
              `${t.gender === "FEMALE" ? "母蟹" : "公蟹"} ${t.weightTier}`,
              t.inputCount,
              t.status === "COMPLETED" ? t.qualifiedCount : "—",
              t.status === "COMPLETED" ? t.lossCount : "—",
              t.status === "COMPLETED" ? `${t.lossRate}%` : "—",
              t.status === "COMPLETED" ? "已完成" : "待分拣",
            ])}
            total={sortTasks.length}
            page={l5Page}
            pageSize={l5PageSize}
            pageParam="l5Page"
            pageSizeParam="l5PageSize"
          >
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>FJR 任务</TableHead>
                  <TableHead>KZD 批次</TableHead>
                  <TableHead>YL 批次</TableHead>
                  <TableHead>设备</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>投入数</TableHead>
                  <TableHead>合格数</TableHead>
                  <TableHead>损耗数</TableHead>
                  <TableHead>损耗率</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSortTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">暂无分拣作业记录</TableCell></TableRow>
                ) : pagedSortTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{formatDate(t.date)}</TableCell>
                    <TableCell className="font-mono font-medium text-xs">{t.code}</TableCell>
                    <TableCell className="font-mono text-xs">{t.bundleBatch.code}</TableCell>
                    <TableCell className="font-mono text-xs">{t.bundleBatch.sourceBatch.code}</TableCell>
                    <TableCell className="font-mono text-xs">{t.machine.code}</TableCell>
                    <TableCell className="text-xs">{t.gender === "FEMALE" ? "母蟹" : "公蟹"} {t.weightTier}</TableCell>
                    <TableCell className="font-mono text-xs">{t.inputCount.toLocaleString()} 只</TableCell>
                    <TableCell className="font-mono text-xs">{t.status === "COMPLETED" ? `${t.qualifiedCount.toLocaleString()} 只` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.status === "COMPLETED" ? `${t.lossCount.toLocaleString()} 只` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.status === "COMPLETED" ? `${t.lossRate}%` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] py-0">{t.status === "COMPLETED" ? "已完成" : "待分拣"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 6. 台账六 · 保鲜预冷 */}
        <TabsContent value="ledger6">
          <LedgerCardSection
            title="台账六 · 保鲜预冷（入库、发货核减、损耗与实时余量）"
            exportFilename={`阳澄股份_台账六_保鲜预冷_${selectedDateStr || "全量"}`}
            exportHeaders={["日期", "CR 单号", "库位", "FJR 任务", "KZD 批次", "YL 批次", "规格", "入库数", "已发货", "发货损耗", "当前余量", "经手人"]}
            exportRows={coldLogs.map((log) => {
              const shipped = log.outboundLines.reduce((sum, line) => sum + line.count, 0);
              const loss = log.outboundLosses.reduce((sum, row) => sum + row.count, 0);
              return [
                formatISODate(log.createdAt), log.code, log.store.code, log.sortTask.code,
                log.sortTask.bundleBatch.code, log.sortTask.bundleBatch.sourceBatch.code,
                `${log.sortTask.gender === "FEMALE" ? "母蟹" : "公蟹"} ${log.sortTask.weightTier}`,
                log.count, shipped, loss, Math.max(0, log.count - shipped - loss), log.operator,
              ];
            })}
            total={coldLogs.length}
            page={l6Page}
            pageSize={l6PageSize}
            pageParam="l6Page"
            pageSizeParam="l6PageSize"
          >
            <Table className="min-w-[1500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>CR 单号</TableHead>
                  <TableHead>库位</TableHead>
                  <TableHead>FJR 任务</TableHead>
                  <TableHead>KZD 批次</TableHead>
                  <TableHead>YL 批次</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>入库数</TableHead>
                  <TableHead>已发货</TableHead>
                  <TableHead>发货损耗</TableHead>
                  <TableHead>当前余量</TableHead>
                  <TableHead>经手人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedColdLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">暂无保鲜预冷记录</TableCell></TableRow>
                ) : pagedColdLogs.map((log) => {
                  const shipped = log.outboundLines.reduce((sum, line) => sum + line.count, 0);
                  const loss = log.outboundLosses.reduce((sum, row) => sum + row.count, 0);
                  const available = Math.max(0, log.count - shipped - loss);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{formatDate(log.createdAt)}</TableCell>
                      <TableCell className="font-mono font-medium text-xs">{log.code}</TableCell>
                      <TableCell className="font-mono text-xs">{log.store.code}</TableCell>
                      <TableCell className="font-mono text-xs">{log.sortTask.code}</TableCell>
                      <TableCell className="font-mono text-xs">{log.sortTask.bundleBatch.code}</TableCell>
                      <TableCell className="font-mono text-xs">{log.sortTask.bundleBatch.sourceBatch.code}</TableCell>
                      <TableCell className="text-xs">{log.sortTask.gender === "FEMALE" ? "母蟹" : "公蟹"} {log.sortTask.weightTier}</TableCell>
                      <TableCell className="font-mono text-xs">{log.count.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono text-xs">{shipped.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono text-xs">{loss.toLocaleString()} 只</TableCell>
                      <TableCell className="font-mono font-medium text-xs">{available.toLocaleString()} 只</TableCell>
                      <TableCell className="text-xs">{log.operator}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </LedgerCardSection>
        </TabsContent>

        {/* 7. 台账七 · 出库与订单（管去向） */}
        <TabsContent value="ledger7">
          <LedgerCardSection
            title="台账七 · 出库与订单（管去向 · 成品核销与物流溯源）"
            exportFilename={`阳澄股份_台账七_出库与订单_${selectedDateStr || "全量"}`}
            exportHeaders={[
              "出库日期",
              "CK 单号",
              "生产链路 (CR→FJR→KZD→YL)",
              "分拣批次(FJR)",
              "捆扎批次(KZD)",
              "原料批次(YL)",
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
              const lineage = Array.from(new Set(o.lines.map((line) =>
                `${line.coldLog.code}→${line.coldLog.sortTask.code}→${line.coldLog.sortTask.bundleBatch.code}→${line.coldLog.sortTask.bundleBatch.sourceBatch.code}`
              ))).join(", ") || "—";
              const sortBatches = Array.from(new Set(o.lines.map((line) =>
                line.coldLog.sortTask.code
              ))).join(", ") || "—";
              const bundleBatches = Array.from(new Set(o.lines.map((line) =>
                line.coldLog.sortTask.bundleBatch.code
              ))).join(", ") || "—";
              const rawBatches = Array.from(new Set(o.lines.map((line) =>
                line.coldLog.sortTask.bundleBatch.sourceBatch.code
              ))).join(", ") || "—";
              const waybills = o.lines
                .map((l) => l.waybillNo)
                .filter(Boolean)
                .join(", ");
              const logisticsDisplay =
                o.logisticsNo || waybills || (o.lines.length > 0 ? `待回填 ${o.lines.length} 单` : "待回填");
              return [
                formatISODate(o.createdAt),
                o.code,
                lineage,
                sortBatches,
                bundleBatches,
                rawBatches,
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
            page={l7Page}
            pageSize={l7PageSize}
            pageParam="l7Page"
            pageSizeParam="l7PageSize"
          >
            <Table className="min-w-[1500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">出库日期</TableHead>
                  <TableHead className="w-[120px]">CK 单号</TableHead>
                  <TableHead className="min-w-[260px]">生产链路 (CR→FJR→KZD→YL)</TableHead>
                  <TableHead className="min-w-[120px]">分拣批次(FJR)</TableHead>
                  <TableHead className="min-w-[120px]">捆扎批次(KZD)</TableHead>
                  <TableHead className="min-w-[120px]">原料批次(YL)</TableHead>
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
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      暂无出库与订单台账记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOutboundOrders.map((o) => {
                    const lineage = Array.from(new Set(o.lines.map((line) =>
                      `${line.coldLog.code} → ${line.coldLog.sortTask.code} → ${line.coldLog.sortTask.bundleBatch.code} → ${line.coldLog.sortTask.bundleBatch.sourceBatch.code}`
                    ))).join(", ") || "—";
                    const sortBatches = Array.from(new Set(o.lines.map((line) =>
                      line.coldLog.sortTask.code
                    ))).join(", ") || "—";
                    const bundleBatches = Array.from(new Set(o.lines.map((line) =>
                      line.coldLog.sortTask.bundleBatch.code
                    ))).join(", ") || "—";
                    const rawBatches = Array.from(new Set(o.lines.map((line) =>
                      line.coldLog.sortTask.bundleBatch.sourceBatch.code
                    ))).join(", ") || "—";
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
                        <TableCell className="font-mono text-xs text-muted-foreground">{lineage}</TableCell>
                        <TableCell className="font-mono text-xs">{sortBatches}</TableCell>
                        <TableCell className="font-mono text-xs">{bundleBatches}</TableCell>
                        <TableCell className="font-mono text-xs">{rawBatches}</TableCell>
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

        {/* 8. 台账八 · 品控记录表（管过程） */}
        <TabsContent value="qcLedger">
          <LedgerCardSection
            title="台账八 · 品控记录表（管过程 · 12 类纸质品控电子化留痕与原件存证）"
            exportFilename={`阳澄股份_台账八_品控记录表_${selectedDateStr || "全量"}`}
            exportHeaders={["日期", "记录编号", "类型", "关联对象", "内容", "结果", "上传人"]}
            exportRows={qcRecords.map((q) => [
              formatDateTime(q.checkTime),
              q.code,
              QC_CATEGORY_LABELS[q.cat] || q.cat,
              q.refId,
              q.title,
              q.result === "QUALIFIED" || q.conclusion === "合格"
                ? "合格"
                : q.result === "RECTIFYING" || q.conclusion === "待整改" || q.conclusion?.includes("整改")
                ? "待整改"
                : "不合格",
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
                    return (
                      <TableRow key={q.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs">
                          {formatShortDateTime(q.checkTime)}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-xs">{q.code}</TableCell>
                        <TableCell className="text-xs">
                          {QC_CATEGORY_LABELS[q.cat] || q.cat}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{q.refId}</TableCell>
                        <TableCell className="text-xs font-medium">{q.title}</TableCell>
                        <TableCell>
                          {q.result === "UNQUALIFIED" || q.conclusion === "不合格" ? (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              <AlertTriangle className="size-3 mr-0.5" /> 不合格
                            </Badge>
                          ) : q.result === "RECTIFYING" || q.conclusion === "待整改" || q.conclusion?.includes("整改") ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[10px] py-0">
                              <AlertTriangle className="size-3 mr-0.5" /> 待整改
                            </Badge>
                          ) : q.result === "EXCEPTION" ? (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              <AlertTriangle className="size-3 mr-0.5" /> {q.conclusion || "异常"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px] py-0">
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
