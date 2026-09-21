import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ExportLedgerButton } from "@/components/ledgers/ExportLedgerButton";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { LedgerTabCarousel } from "@/components/ledgers/LedgerTabCarousel";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { FileCheck } from "lucide-react";
import { Invariants } from "@/lib/invariants";
import { cn, formatDate, formatTime, getBeijingDayRange } from "@/lib/utils";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type ExportValue = string | number;
type ExportSection = { title?: string; headers: string[]; rows: ExportValue[][] };

type LedgerCardSectionProps = {
  title: string;
  sheetName: string;
  exportFilename: string;
  exportHeaders: string[];
  exportRows: ExportValue[][];
  exportSections?: ExportSection[];
  children: ReactNode;
  total: number;
  page: number;
  pageSize: number;
  pageParam: string;
  pageSizeParam: string;
};

function LedgerCardSection({
  title,
  sheetName,
  exportFilename,
  exportHeaders,
  exportRows,
  exportSections,
  children,
  total,
  page,
  pageSize,
  pageParam,
  pageSizeParam,
}: LedgerCardSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ExportLedgerButton
          filename={exportFilename}
          sheetName={sheetName}
          headers={exportHeaders}
          rows={exportRows}
          sections={exportSections}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
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

function LedgerTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="whitespace-nowrap text-xs">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="py-8 text-center text-xs text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-muted/40">
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="whitespace-nowrap text-xs">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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

const SPEC_MATRIX = [
  { header: "2.5母", gender: "FEMALE", weightTier: "2.5两" },
  { header: "3.5公", gender: "MALE", weightTier: "3.5两" },
  { header: "3.0母", gender: "FEMALE", weightTier: "3.0两" },
  { header: "4.0公", gender: "MALE", weightTier: "4.0两" },
  { header: "3.5母", gender: "FEMALE", weightTier: "3.5两" },
  { header: "4.5公", gender: "MALE", weightTier: "4.5两" },
  { header: "4.0母", gender: "FEMALE", weightTier: "4.0两" },
  { header: "5.0公", gender: "MALE", weightTier: "5.0两" },
  { header: "5.0母", gender: "FEMALE", weightTier: "5.0两" },
  { header: "6.0公", gender: "MALE", weightTier: "6.0两" },
] as const;

const genderText = (gender?: string | null) => (gender === "FEMALE" ? "母" : gender === "MALE" ? "公" : "—");
const specText = (gender?: string | null, weightTier?: string | null) =>
  gender && weightTier ? `${gender === "FEMALE" ? "母蟹" : "公蟹"} ${weightTier}` : "—";
const weightNumber = (weightTier?: string | null) => {
  const value = Number.parseFloat(String(weightTier || "").replace("两", ""));
  return Number.isFinite(value) ? value : "—";
};
const rateText = (loss: number, total: number) => (total > 0 ? `${((loss / total) * 100).toFixed(2)}%` : "0.00%");
const qcText = (value?: string | null) =>
  value === "QUALIFIED" ? "合格" : value === "RECTIFYING" ? "待整改" : value === "UNQUALIFIED" ? "不合格" : "—";
const orderStatusText = (status: string) => (status === "SHIPPED" ? "已发货" : "待发货");
const outboundTypeText = (type: string) => (type === "CRAB_CARD" ? "蟹卡提货" : "门店订单");
const claimStatusText = (status: string) =>
  status === "APPROVED" ? "已通过" : status === "REJECTED" ? "已驳回" : "待审核";
const cooperationText = (status: string) =>
  status === "ACTIVE" ? "合作中" : status === "SUSPENDED" ? "暂停合作" : status === "TERMINATED" ? "已终止" : status;
const normalizeWeightTier = (value: string) => {
  const n = Number.parseFloat(value.replace("两", ""));
  return Number.isFinite(n) ? `${n.toFixed(1)}两` : value;
};

function paginate<T>(rows: T[], page: number, pageSize: number) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

export default async function LedgersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [currentUser, params] = await Promise.all([getCurrentUser(), searchParams]);
  const selectedDateStr = params.date?.trim();
  const selectedCat = params.cat?.trim();
  const parsePositive = (value?: string, fallback = 1) => Math.max(1, Number(value) || fallback);
  const pageFor = (index: number) => parsePositive(params[`l${index}Page`]);
  const pageSizeFor = (index: number) => parsePositive(params[`l${index}PageSize`], 10);

  const dateFilter = selectedDateStr ? getBeijingDayRange(selectedDateStr) : undefined;

  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";
  const channelId = currentUser?.channelId;

  const [farmers, rawTagClaims, batches, bundleBatches, sortTasks, coldLogs, outboundOrders, qcRecords, orders, allApprovedOutboundLines] = await Promise.all([
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
    isChannelViewer
      ? []
      : prisma.tagClaim.findMany({
          where: dateFilter ? { claimDate: dateFilter } : undefined,
          include: {
            farmer: {
              include: {
                tagClaims: { where: { status: "APPROVED" } },
                batches: true,
              },
            },
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
          },
          orderBy: { claimDate: "desc" },
        }),
    isChannelViewer
      ? []
      : prisma.batch.findMany({
          where: dateFilter ? { inPoolTime: dateFilter } : undefined,
          include: {
            farmer: true,
            enclosure: true,
            pool: true,
            items: { include: { pool: true } },
          },
          orderBy: { inPoolTime: "desc" },
        }),
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
    isChannelViewer
      ? []
      : prisma.coldLog.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          include: {
            store: true,
            sortTask: { include: { bundleBatch: { include: { sourceBatch: true } } } },
            outboundLines: { where: { outboundOrder: { status: { not: "REJECTED" } } } },
            outboundLosses: { where: { status: { not: "REJECTED" } } },
          },
          orderBy: { createdAt: "desc" },
        }),
    prisma.outboundOrder.findMany({
      where: {
        status: { not: "REJECTED" },
        ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        store: true,
        channel: true,
        applicant: true,
        approver: true,
        lines: {
          include: {
            order: true,
            coldLog: {
              include: {
                store: true,
                sortTask: {
                  include: {
                    bundleBatch: {
                      include: {
                        sourceBatch: { include: { farmer: true, enclosure: true, pool: true } },
                        lines: { include: { pool: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qCRecord.findMany({
      where: {
        ...(selectedCat ? { cat: selectedCat } : {}),
        ...(dateFilter ? { checkTime: dateFilter } : {}),
      },
      orderBy: { checkTime: "desc" },
    }),
    prisma.order.findMany({
      where: {
        ...(dateFilter ? { deliveryDate: dateFilter } : {}),
        ...(isChannelViewer
          ? {
              outboundLines: {
                some: { outboundOrder: { channelId: channelId || "__NO_CHANNEL__", status: { not: "REJECTED" } } },
              },
            }
          : {}),
      },
      include: {
        outboundLines: {
          where: { outboundOrder: { status: { not: "REJECTED" } } },
          include: {
            outboundOrder: { include: { store: true, channel: true } },
            coldLog: {
              include: {
                sortTask: {
                  include: {
                    bundleBatch: { include: { sourceBatch: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ deliveryDate: "desc" }, { importTime: "desc" }],
    }),
    isChannelViewer
      ? []
      : prisma.outboundLine.findMany({
          where: { outboundOrder: { status: "APPROVED" } },
          include: {
            coldLog: {
              include: {
                sortTask: {
                  include: {
                    bundleBatch: { include: { sourceBatch: { include: { farmer: true } } } },
                  },
                },
              },
            },
          },
        }),
  ]);

  const shippedByFarmer = new Map<string, number>();
  for (const line of allApprovedOutboundLines) {
    const farmerId = line.coldLog.sortTask.bundleBatch.sourceBatch.farmer.id;
    shippedByFarmer.set(farmerId, (shippedByFarmer.get(farmerId) || 0) + line.count);
  }

  const farmerRows = farmers.map((farmer) => {
    let cumulativeClaimed = 0, cumulativeBound = 0, cumulativeScrapped = 0, cumulativeReturned = 0;
    for (const c of farmer.tagClaims) {
      cumulativeClaimed += c.claimCount;
      cumulativeBound += c.boundCount;
      cumulativeScrapped += c.scrappedCount;
      cumulativeReturned += c.returnedCount;
    }
    const cumulativeInPool = farmer.batches.reduce((sum, batch) => sum + batch.inPoolCount, 0);
    const cumulativeOutbound = shippedByFarmer.get(farmer.id) || 0;
    const exportRow: ExportValue[] = [
      farmer.code,
      farmer.name,
      farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
      farmer.enclosures.map((item) => item.code).join(", ") || "—",
      farmer.area,
      farmer.quota,
      cumulativeInPool,
      cumulativeClaimed,
      cumulativeBound,
      cumulativeScrapped,
      cumulativeReturned,
      cumulativeOutbound,
      Math.max(0, farmer.quota - cumulativeBound),
      farmer.creditRating || "A",
      cooperationText(farmer.status),
      farmer.contractUrl || farmer.contractName || "—",
    ];
    const displayRow: ReactNode[] = [...exportRow];
    if (farmer.contractUrl) {
      displayRow[displayRow.length - 1] = (
        <a href={farmer.contractUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
          {farmer.contractName || "查看附件"}
        </a>
      );
    }
    return { exportRow, displayRow };
  });

  const rawMaterialRows = batches.flatMap((batch) => {
    const items = batch.items.length
      ? batch.items
      : [{
          id: `${batch.id}-fallback`,
          gender: batch.gender,
          weightTier: batch.weightTier,
          weight: 0,
          inPoolCount: batch.inPoolCount,
          outPoolCount: batch.outPoolCount,
          lossCount: batch.lossCount,
          pool: batch.pool,
        }];
    return items.map((item) => {
      const exportRow: ExportValue[] = [
        formatDate(batch.inPoolTime),
        formatTime(batch.inPoolTime),
        batch.code,
        batch.farmer.name,
        weightNumber(item.weightTier),
        genderText(item.gender),
        item.inPoolCount,
        item.weight,
        item.pool.name || item.pool.code,
        item.pool.code,
        Math.max(0, item.inPoolCount - item.outPoolCount - item.lossCount),
        item.outPoolCount,
        item.lossCount,
        rateText(item.lossCount, item.inPoolCount),
        qcText(batch.quickCheck),
        qcText(batch.sampleCheck),
        batch.escort || "—",
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const tagClaimRows = rawTagClaims.map((claim) => {
    const isRejected = claim.status === "REJECTED";
    const cumulativeBound = claim.farmer.tagClaims.reduce((sum, item) => sum + item.boundCount, 0);
    const tagInboundCount = claim.farmer.batches?.reduce((sum, b) => sum + b.inPoolCount, 0) ?? 0;
    const balanceDiff = claim.claimCount - claim.boundCount - claim.returnedCount - claim.scrappedCount;

    const { outboundCount, totalDownstreamLoss } = Invariants.getClaimDownstreamMetrics(claim);

    const exportRow: ExportValue[] = [
      formatDate(claim.claimDate),
      formatTime(claim.claimDate),
      claim.code || "—",
      claim.farmer.name,
      isRejected ? 0 : tagInboundCount,
      isRejected ? 0 : claim.claimCount,
      isRejected ? 0 : claim.boundCount,
      isRejected ? 0 : outboundCount,
      isRejected ? 0 : totalDownstreamLoss,
      isRejected ? 0 : claim.returnedCount,
      isRejected ? 0 : claim.scrappedCount,
      isRejected ? 0 : balanceDiff,
      isRejected ? "已驳回" : claim.isBalanced ? "已轧平" : "未轧平",
      isRejected ? 0 : cumulativeBound,
      isRejected ? claim.farmer.quota : Math.max(0, claim.farmer.quota - cumulativeBound),
      claim.applicant?.fullName || "—",
      claim.approver?.fullName || "—",
      claimStatusText(claim.status),
    ];
    return { exportRow, displayRow: exportRow as ReactNode[] };
  });

  const holdingPoolRows = batches.flatMap((batch) => {
    const groups = new Map<string, { poolName: string; poolCode: string; inCount: number; outCount: number; lossCount: number }>();
    const items = batch.items.length
      ? batch.items
      : [{ pool: batch.pool, inPoolCount: batch.inPoolCount, outPoolCount: batch.outPoolCount, lossCount: batch.lossCount }];
    for (const item of items) {
      const current = groups.get(item.pool.code) || {
        poolName: item.pool.name || item.pool.code,
        poolCode: item.pool.code,
        inCount: 0,
        outCount: 0,
        lossCount: 0,
      };
      current.inCount += item.inPoolCount;
      current.outCount += item.outPoolCount;
      current.lossCount += item.lossCount;
      groups.set(item.pool.code, current);
    }
    return Array.from(groups.values()).map((group) => {
      const exportRow: ExportValue[] = [
        formatDate(batch.inPoolTime),
        formatTime(batch.inPoolTime),
        group.poolName,
        group.poolCode,
        batch.code,
        batch.farmer.name,
        batch.enclosure?.code || "—",
        group.inCount,
        group.outCount,
        Math.max(0, group.inCount - group.outCount - group.lossCount),
        group.lossCount,
        rateText(group.lossCount, group.inCount),
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const bundlingRows = bundleBatches.flatMap((batch) => {
    const lines = batch.lines.length
      ? batch.lines
      : [{
          id: `${batch.id}-fallback`,
          pool: null,
          gender: null,
          weightTier: null,
          count: batch.inputCount,
          qualifiedCount: batch.qualifiedCount,
          lossCount: batch.lossCount,
        }];
    return lines.map((line) => {
      const qualified = batch.status === "COMPLETED" ? line.qualifiedCount ?? Math.max(0, line.count - (line.lossCount ?? 0)) : 0;
      const loss = batch.status === "COMPLETED" ? line.lossCount ?? Math.max(0, line.count - qualified) : 0;
      const exportRow: ExportValue[] = [
        formatDate(batch.date),
        formatTime(batch.doneAt || batch.createdAt),
        batch.code,
        batch.group.name,
        batch.group.code,
        batch.sourceBatch.code,
        batch.tagClaim.code || "—",
        batch.ropeBatch,
        batch.tagClaim.farmer.name,
        line.pool?.name || "—",
        line.pool?.code || "—",
        specText(line.gender, line.weightTier),
        batch.status === "COMPLETED" ? "已完成" : "捆扎中",
        genderText(line.gender),
        line.count,
        qualified,
        loss,
        rateText(loss, line.count),
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const sortingRows = sortTasks.map((task) => {
    const exportRow: ExportValue[] = [
      formatDate(task.date),
      formatTime(task.doneAt || task.createdAt),
      task.code,
      task.machine.name || "—",
      task.machine.code,
      task.bundleBatch.sourceBatch.code,
      task.bundleBatch.code,
      specText(task.gender, task.weightTier),
      genderText(task.gender),
      task.status === "COMPLETED" ? "已完成" : "待分拣",
      task.inputCount,
      task.status === "COMPLETED" ? task.qualifiedCount : 0,
      task.status === "COMPLETED" ? task.lossCount : 0,
      task.status === "COMPLETED" ? rateText(task.lossCount, task.inputCount) : "—",
    ];
    return { exportRow, displayRow: exportRow as ReactNode[] };
  });

  const coldRows = coldLogs.map((log) => {
    const shipped = log.outboundLines.reduce((sum, line) => sum + line.count, 0);
    const loss = log.outboundLosses.reduce((sum, item) => sum + item.count, 0);
    const exportRow: ExportValue[] = [
      formatDate(log.createdAt),
      formatTime(log.createdAt),
      log.code,
      log.store.name || "—",
      log.store.code,
      log.sortTask.bundleBatch.sourceBatch.code,
      log.sortTask.bundleBatch.code,
      log.sortTask.code,
      specText(log.sortTask.gender, log.sortTask.weightTier),
      log.count,
      shipped,
      loss,
      Math.max(0, log.count - shipped - loss),
      log.operator,
    ];
    return { exportRow, displayRow: exportRow as ReactNode[] };
  });

  const outboundHeaderRows = outboundOrders.map((order) => {
    const exportRow: ExportValue[] = [
      formatDate(order.createdAt),
      formatTime(order.createdAt),
      order.code,
      outboundTypeText(order.type),
      order.outboundCount,
      order.transportCompany || (order.logisticsNo === "门店冷链专车自配" ? order.logisticsNo : "—"),
      order.contactName || "—",
      order.contactPhone || "—",
      order.applicant?.fullName || "—",
      order.approver?.fullName || "—",
    ];
    return { exportRow, displayRow: exportRow as ReactNode[] };
  });

  const outboundMatrixRows = outboundOrders.map((order) => {
    const counts = new Map<string, number>();
    for (const line of order.lines) {
      const key = `${line.gender}_${normalizeWeightTier(line.weightTier)}`;
      counts.set(key, (counts.get(key) || 0) + line.count);
    }
    const destination = order.type === "CRAB_CARD" ? "蟹卡宅配" : `${order.channel.name} / ${order.store.name}`;
    return [
      order.code,
      destination,
      ...SPEC_MATRIX.map((item) => counts.get(`${item.gender}_${item.weightTier}`) || 0),
      order.outboundCount,
    ] as ExportValue[];
  });

  const outboundDetailRows = outboundOrders.flatMap((order) =>
    order.lines.map((line) => {
      const bundle = line.coldLog.sortTask.bundleBatch;
      const sourceBatch = bundle.sourceBatch;
      const sourcePools = bundle.lines
        .filter((item) => item.gender === line.gender && normalizeWeightTier(item.weightTier) === normalizeWeightTier(line.weightTier))
        .map((item) => item.pool.code);
      const exportRow: ExportValue[] = [
        formatDate(order.createdAt),
        formatTime(order.createdAt),
        order.code,
        sourceBatch.code,
        bundle.code,
        line.coldLog.sortTask.code,
        line.coldLog.code,
        specText(line.gender, line.weightTier),
        genderText(line.gender),
        line.count,
        Array.from(new Set(sourcePools)).join(", ") || sourceBatch.pool.code || "—",
        sourceBatch.farmer.name,
        sourceBatch.enclosure?.code || "—",
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    })
  );

  const qcRows = qcRecords.map((record) => {
    const result =
      record.result === "QUALIFIED" || record.conclusion === "合格"
        ? "合格"
        : record.result === "RECTIFYING" || record.conclusion?.includes("整改")
          ? "待整改"
          : record.result === "UNQUALIFIED" || record.conclusion === "不合格"
            ? "不合格"
            : record.conclusion || "异常";
    const attachment = record.fileUrl || record.fileName || "—";
    const exportRow: ExportValue[] = [
      formatDate(record.checkTime),
      formatTime(record.checkTime),
      record.code,
      QC_CATEGORY_LABELS[record.cat] || record.cat,
      record.formNo || "—",
      record.uploader || "—",
      result,
      record.reason || "—",
      attachment,
      record.uploader || "—",
    ];
    const displayRow: ReactNode[] = [...exportRow];
    if (record.fileUrl) {
      displayRow[8] = (
        <a href={record.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
          {record.fileName || "查看附件"}
        </a>
      );
    }
    return { exportRow, displayRow };
  });

  const storeOrderRows = orders
    .filter((order) => order.type === "STORE_ORDER")
    .flatMap((order) => {
      const lines = order.outboundLines.length ? order.outboundLines : [null];
      return lines.map((line) => {
        const task = line?.coldLog.sortTask;
        const bundle = task?.bundleBatch;
        const exportRow: ExportValue[] = [
          formatDate(order.deliveryDate),
          order.code,
          formatDate(order.importTime),
          formatTime(order.importTime),
          order.orderNo,
          order.storeName || line?.outboundOrder.store.name || "—",
          specText(order.gender, order.weightTier),
          genderText(order.gender),
          line?.count ?? order.count,
          orderStatusText(order.status),
          line?.outboundOrder.code || "—",
          bundle?.sourceBatch.code || "—",
          bundle?.code || "—",
          task?.code || "—",
          line?.coldLog.code || "—",
          line?.waybillNo || line?.outboundOrder.logisticsNo || "—",
        ];
        return { exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const crabCardRows = orders
    .filter((order) => order.type === "CRAB_CARD")
    .flatMap((order) => {
      const lines = order.outboundLines.length ? order.outboundLines : [null];
      return lines.map((line) => {
        const exportRow: ExportValue[] = [
          formatDate(order.deliveryDate),
          order.code,
          formatDate(order.importTime),
          formatTime(order.importTime),
          order.orderNo,
          order.specModel || "—",
          specText(order.gender, order.weightTier),
          genderText(order.gender),
          line?.count ?? order.count,
          orderStatusText(order.status),
          line?.outboundOrder.code || "—",
          line?.expressCompany || line?.outboundOrder.transportCompany || "—",
          line?.waybillNo || "—",
          line?.waybillNo ? "—" : line?.outboundOrder.logisticsNo || "—",
        ];
        return { exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const headers = {
    l1: ["编号", "姓名", "养殖类型", "围网", "面积(亩)", "年度额度(只)", "累计入池(只)", "累计领扣(只)", "累计绑扎(只)", "累计作废", "累计回退", "累计出库(只)", "额度结余(只)", "信用评级", "合作状态", "合同附件"],
    l2: ["入库日期", "入库时间", "原料批次", "养殖户", "规格(两)", "公母", "只数", "斤数", "池名", "池号", "在池", "发货", "累计损耗", "损耗率", "农残快检", "品质抽检", "跟车员"],
    l3: ["申领日期", "申领时间", "蟹扣批次", "蟹扣养殖户", "蟹扣入仓数", "申领数", "完成绑扎", "其中-已出库", "其中-后道损耗", "退回", "作废", "差额", "轧平校验", "累计绑扎", "剩余额度", "申请人", "复核人", "审核状态"],
    l4: ["入池日期", "入池时间", "池名", "池号", "原料批次", "养殖户", "围网", "入池数量", "绑扎数量", "在池数量", "损耗(只)", "损耗率"],
    l5: ["捆扎日期", "捆扎时间", "捆扎批次", "班组", "班组编号", "原料批次", "蟹扣批次", "蟹绳批次", "养殖户", "池名", "池号", "规格", "状态", "公母", "初始捆扎只数", "捆扎完成只数", "损耗", "损耗率"],
    l6: ["分拣日期", "分拣时间", "分拣批次", "设备名", "设备编号", "原料批次", "绑扎批次", "规格", "公母", "状态", "投入(只)", "合格(只)", "损耗(只)", "损耗率"],
    l7: ["日期", "入库时间", "入库单号", "库名", "库位", "原料批次", "捆扎批次", "分拣任务", "规格", "入库(只)", "已发货(只)", "发货损耗(只)", "当前余量", "经手人"],
    l8: ["出库日期", "出库时间", "出库批次", "出库类型", "合计数量(只)", "承运物流公司", "联系人", "联系方式", "出库申请人", "复核人"],
    l9: ["出库日期", "出库时间", "CK 单号", "原料批次", "捆扎批次", "分拣任务", "预冷单", "规格", "公母", "数量(只)", "来源池", "养殖户", "围网"],
    l10: ["记录日期", "记录时间", "记录编号", "记录类型", "表格编号", "质检人员", "结论", "异常原因", "附件", "记录人"],
    l11: ["发货日期", "订单号(SO)", "导入日期", "导入时间", "原始单号", "门店", "规格", "公母", "只数", "订单状态", "出库单(CK)", "原料批次", "捆扎批次", "分拣任务", "预冷单", "物流单号"],
    l12: ["发货日期", "订单号(SO)", "导入日期", "导入时间", "原始单号(KK)", "规格型号（原始）", "拆分规格", "公母", "只数", "订单状态", "出库单(CK)", "快递公司", "物流单号", "备注"],
  };

  const ledgers = [
    { key: "ledger1", no: 1, label: "01 养殖户主档", title: "01 养殖户主档", sheet: "01 养殖户主档", headers: headers.l1, rows: farmerRows, empty: "暂无养殖户主档数据" },
    { key: "ledger2", no: 2, label: "02 原料批次", title: "02 原料批次台账", sheet: "02 原料批次台账", headers: headers.l2, rows: rawMaterialRows, empty: "暂无原料批次数据" },
    { key: "ledger3", no: 3, label: "03 蟹扣领用", title: "03 蟹扣领用台账", sheet: "03 蟹扣领用台账", headers: headers.l3, rows: tagClaimRows, empty: "暂无蟹扣领用数据" },
    { key: "ledger4", no: 4, label: "04 暂养池流水", title: "04 暂养池流水", sheet: "04 暂养池流水", headers: headers.l4, rows: holdingPoolRows, empty: "暂无暂养池流水" },
    { key: "ledger5", no: 5, label: "05 捆扎作业", title: "05 捆扎作业台账", sheet: "05 捆扎作业台账", headers: headers.l5, rows: bundlingRows, empty: "暂无捆扎作业数据" },
    { key: "ledger6", no: 6, label: "06 分拣作业", title: "06 分拣作业台账", sheet: "06 分拣作业台账", headers: headers.l6, rows: sortingRows, empty: "暂无分拣作业数据" },
    { key: "ledger7", no: 7, label: "07 保鲜预冷", title: "07 保鲜预冷台账", sheet: "07 保鲜预冷台账", headers: headers.l7, rows: coldRows, empty: "暂无保鲜预冷数据" },
    { key: "ledger8", no: 8, label: "08 出库单", title: "08 出库单", sheet: "08 出库单", headers: headers.l8, rows: outboundHeaderRows, empty: "暂无出库单数据" },
    { key: "ledger9", no: 9, label: "09 出库明细", title: "09 出库明细", sheet: "09 出库明细", headers: headers.l9, rows: outboundDetailRows, empty: "暂无出库明细" },
    { key: "ledger10", no: 10, label: "10 品控记录", title: "10 品控记录表", sheet: "10 品控记录表", headers: headers.l10, rows: qcRows, empty: "暂无品控记录" },
    { key: "ledger11", no: 11, label: "11 门店订单", title: "11 门店订单台账", sheet: "11 门店订单台账", headers: headers.l11, rows: storeOrderRows, empty: "暂无门店订单数据" },
    { key: "ledger12", no: 12, label: "12 蟹卡提货", title: "12 蟹卡提货台账", sheet: "12 蟹卡提货台账", headers: headers.l12, rows: crabCardRows, empty: "暂无蟹卡提货数据" },
  ];

  const validTab = params.tab && ledgers.some((l) => l.key === params.tab) ? params.tab : "ledger1";
  const totalLedgerRecords = ledgers.reduce((acc, l) => acc + l.rows.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <FileCheck className="size-6 text-primary" />
            全链路合规台账
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            全链路 12 张业务台账（共 {totalLedgerRecords} 条合规流水），支持各环节穿透追溯与原样数据导出。
          </p>
        </div>
        <LedgerDateFilter selectedDate={selectedDateStr} />
      </div>

      <Tabs defaultValue={validTab} className="flex flex-col gap-4">
        <LedgerTabCarousel
          ledgers={ledgers.map((l) => ({
            key: l.key,
            no: l.no,
            label: l.label,
            count: l.rows.length,
          }))}
        />

        {ledgers.map((ledger) => {
          const page = pageFor(ledger.no);
          const pageSize = pageSizeFor(ledger.no);
          const pagedRows = paginate(ledger.rows, page, pageSize);
          const exportRows = ledger.rows.map((row) => row.exportRow);
          const isOutboundHeader = ledger.no === 8;
          const matrixHeaders = ["出库批次", "礼卡/门店名称", ...SPEC_MATRIX.map((item) => item.header), "合计"];
          const pagedOutboundMatrixRows = isOutboundHeader ? paginate(outboundMatrixRows, page, pageSize) : [];
          const exportSections = isOutboundHeader
            ? [
                { headers: ledger.headers, rows: exportRows },
                { title: "成品出库规格矩阵", headers: matrixHeaders, rows: outboundMatrixRows },
              ]
            : undefined;

          return (
            <TabsContent key={ledger.key} value={ledger.key}>
              <LedgerCardSection
                title={ledger.title}
                sheetName={ledger.sheet}
                exportFilename={`阳澄股份_${ledger.sheet}_${selectedDateStr || "全量"}`}
                exportHeaders={ledger.headers}
                exportRows={exportRows}
                exportSections={exportSections}
                total={ledger.rows.length}
                page={page}
                pageSize={pageSize}
                pageParam={`l${ledger.no}Page`}
                pageSizeParam={`l${ledger.no}PageSize`}
              >
                <div className="flex flex-col gap-4">
                  <LedgerTable
                    headers={ledger.headers}
                    rows={pagedRows.map((row) => row.displayRow)}
                    emptyText={ledger.empty}
                  />
                  {isOutboundHeader && outboundMatrixRows.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-medium text-muted-foreground">成品出库规格矩阵</div>
                      <LedgerTable
                        headers={matrixHeaders}
                        rows={pagedOutboundMatrixRows as ReactNode[][]}
                        emptyText="暂无出库规格汇总"
                      />
                    </div>
                  )}
                </div>
              </LedgerCardSection>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
