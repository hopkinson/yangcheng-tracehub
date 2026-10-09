import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ExportLedgerButton, type ExportValue, type ExportSection } from "@/components/ledgers/ExportLedgerButton";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { LedgerTabCarousel } from "@/components/ledgers/LedgerTabCarousel";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { FileCheck } from "lucide-react";
import { Invariants } from "@/lib/invariants";
import { SHOW_TAG_RETURN } from "@/lib/feature-flags";
import { cn, formatDate, formatTime, formatDateTime, getBeijingDayRange, getPreviewFileUrl } from "@/lib/utils";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

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

const toDisplayRow = (row: ExportValue[]): ReactNode[] => row.map((v) => v as ReactNode);

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
  QUICK_CHECK: "1. 药残及重金属快检",
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
const outboundTypeText = (type: string) => (type === "CRAB_CARD" ? "提蟹订单" : "门店订单");
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
  const rawTab = params.tab?.trim();
  const validTab = /^ledger([1-9]|1[0-2])$/.test(rawTab ?? "") ? rawTab! : "ledger1";

  const parsePositive = (value?: string, fallback = 1) => Math.max(1, Number(value) || fallback);
  const pageFor = (index: number) => parsePositive(params[`l${index}Page`]);
  const pageSizeFor = (index: number) => parsePositive(params[`l${index}PageSize`], 10);

  const dateFilter = selectedDateStr ? getBeijingDayRange(selectedDateStr) : undefined;

  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";
  const channelId = currentUser?.channelId;

  const [
    // 快速徽标计数统计
    countFarmers,
    countBatchItems,
    countBatches,
    countTagClaims,
    countBundleLines,
    countBundleBatches,
    countSortTasks,
    countColdLogs,
    countOutboundOrders,
    countOutboundLines,
    countQcRecords,
    countStoreOrders,
    countCrabCardOrders,
    // 当前激活 Tab 所需的具体数据集
    farmers,
    rawTagClaims,
    batches,
    bundleBatches,
    sortTasks,
    coldLogs,
    outboundOrders,
    qcRecords,
    orders,
    allApprovedOutboundLines,
  ] = await Promise.all([
    isChannelViewer ? 0 : prisma.farmer.count(),
    isChannelViewer ? 0 : prisma.batchItem.count({ where: dateFilter ? { batch: { inPoolTime: dateFilter } } : undefined }),
    isChannelViewer ? 0 : prisma.batch.count({ where: dateFilter ? { inPoolTime: dateFilter } : undefined }),
    isChannelViewer ? 0 : prisma.tagClaim.count({ where: dateFilter ? { claimDate: dateFilter } : undefined }),
    isChannelViewer ? 0 : prisma.bundleLine.count({ where: dateFilter ? { bundleBatch: { date: dateFilter } } : undefined }),
    isChannelViewer ? 0 : prisma.bundleBatch.count({ where: dateFilter ? { date: dateFilter } : undefined }),
    isChannelViewer ? 0 : prisma.sortTask.count({ where: dateFilter ? { date: dateFilter } : undefined }),
    isChannelViewer ? 0 : prisma.coldLog.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
    prisma.outboundOrder.count({
      where: {
        status: { not: "REJECTED" },
        ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}),
        ...(dateFilter
          ? {
              OR: [
                { createdAt: dateFilter },
                { outboundTime: dateFilter },
                { approvedAt: dateFilter },
              ],
            }
          : {}),
      },
    }),
    prisma.outboundLine.count({
      where: {
        outboundOrder: {
          status: { not: "REJECTED" },
          ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}),
          ...(dateFilter
            ? {
                OR: [
                  { createdAt: dateFilter },
                  { outboundTime: dateFilter },
                  { approvedAt: dateFilter },
                ],
              }
            : {}),
        },
      },
    }),
    prisma.qCRecord.count({
      where: {
        ...(selectedCat ? { cat: selectedCat } : {}),
        ...(dateFilter ? { checkTime: dateFilter } : {}),
      },
    }),
    prisma.order.count({
      where: {
        type: "STORE_ORDER",
        ...(dateFilter ? { deliveryDate: dateFilter } : {}),
        ...(isChannelViewer
          ? {
              outboundLines: {
                some: { outboundOrder: { channelId: channelId || "__NO_CHANNEL__", status: { not: "REJECTED" } } },
              },
            }
          : {}),
      },
    }),
    prisma.order.count({
      where: {
        type: "CRAB_CARD",
        ...(dateFilter ? { deliveryDate: dateFilter } : {}),
        ...(isChannelViewer
          ? {
              outboundLines: {
                some: { outboundOrder: { channelId: channelId || "__NO_CHANNEL__", status: { not: "REJECTED" } } },
              },
            }
          : {}),
      },
    }),
    // 养殖户查询 (ledger1 或 ledger3)
    !needFarmers || isChannelViewer
      ? Promise.resolve([])
      : validTab === "ledger1"
      ? prisma.farmer.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            farmType: true,
            area: true,
            quota: true,
            creditRating: true,
            status: true,
            contractUrl: true,
            contractName: true,
            enclosures: { select: { code: true } },
            batches: { select: { inPoolCount: true } },
            tagClaims: {
              where: { status: "APPROVED" },
              select: { claimCount: true, boundCount: true, scrappedCount: true, returnedCount: true },
            },
          },
          orderBy: { code: "asc" },
        })
      : prisma.farmer.findMany({
          select: {
            id: true,
            quota: true,
            batches: { select: { inPoolCount: true } },
            tagClaims: {
              where: { status: "APPROVED" },
              select: { boundCount: true },
            },
          },
        }),
    // 蟹扣申领查询 (ledger3)
    !needTagClaims || isChannelViewer
      ? Promise.resolve([])
      : prisma.tagClaim.findMany({
          where: dateFilter ? { claimDate: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            claimDate: true,
            claimCount: true,
            boundCount: true,
            scrappedCount: true,
            returnedCount: true,
            isBalanced: true,
            status: true,
            farmerId: true,
            farmer: {
              select: {
                id: true,
                name: true,
                quota: true,
              },
            },
            applicant: { select: { fullName: true } },
            approver: { select: { fullName: true } },
            bundleBatches: {
              select: {
                sortTasks: {
                  select: {
                    lossCount: true,
                    coldLogs: {
                      select: {
                        outboundLines: {
                          where: { outboundOrder: { status: { not: "REJECTED" } } },
                          select: { count: true },
                        },
                        outboundLosses: {
                          where: { status: { not: "REJECTED" } },
                          select: { count: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { claimDate: "desc" },
        }),
    // 原料批次查询 (ledger2 原料批次 或 ledger4 暂养池流水)
    isChannelViewer || (!needRawMaterialBatches && !needHoldingPoolBatches)
      ? Promise.resolve([])
      : needRawMaterialBatches
      ? prisma.batch.findMany({
          where: dateFilter ? { inPoolTime: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            inPoolTime: true,
            gender: true,
            weightTier: true,
            inPoolCount: true,
            outPoolCount: true,
            lossCount: true,
            quickCheck: true,
            sampleCheck: true,
            escort: true,
            farmer: {
              select: {
                name: true,
                enclosures: { select: { code: true } },
              },
            },
            enclosure: { select: { code: true } },
            pool: { select: { name: true, code: true } },
            items: {
              select: {
                id: true,
                gender: true,
                weightTier: true,
                weight: true,
                inPoolCount: true,
                outPoolCount: true,
                lossCount: true,
                pool: { select: { name: true, code: true } },
              },
            },
            bundleBatches: {
              select: {
                lossCount: true,
                lines: {
                  select: {
                    gender: true,
                    weightTier: true,
                    count: true,
                    lossCount: true,
                  },
                },
                sortTasks: {
                  select: {
                    gender: true,
                    weightTier: true,
                    lossCount: true,
                    coldLogs: {
                      select: {
                        outboundLines: {
                          where: { outboundOrder: { status: { not: "REJECTED" } } },
                          select: { count: true },
                        },
                        outboundLosses: {
                          where: { status: { not: "REJECTED" } },
                          select: { count: true, lossType: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { inPoolTime: "desc" },
        })
      : prisma.batch.findMany({
          where: dateFilter ? { inPoolTime: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            inPoolTime: true,
            inPoolCount: true,
            outPoolCount: true,
            lossCount: true,
            farmer: {
              select: {
                name: true,
                enclosures: { select: { code: true } },
              },
            },
            enclosure: { select: { code: true } },
            pool: { select: { name: true, code: true } },
            items: {
              select: {
                id: true,
                inPoolCount: true,
                outPoolCount: true,
                lossCount: true,
                pool: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: { inPoolTime: "desc" },
        }),
    // 捆扎批次查询 (ledger5)
    !needBundleBatches || isChannelViewer
      ? Promise.resolve([])
      : prisma.bundleBatch.findMany({
          where: dateFilter ? { date: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            date: true,
            doneAt: true,
            createdAt: true,
            status: true,
            inputCount: true,
            qualifiedCount: true,
            lossCount: true,
            ropeBatch: true,
            group: { select: { name: true, code: true } },
            tagClaim: {
              select: {
                code: true,
                farmer: { select: { name: true } },
              },
            },
            sourceBatch: { select: { code: true } },
            lines: {
              select: {
                gender: true,
                weightTier: true,
                count: true,
                qualifiedCount: true,
                lossCount: true,
                pool: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),
    // 分拣任务查询 (ledger6)
    !needSortTasks || isChannelViewer
      ? Promise.resolve([])
      : prisma.sortTask.findMany({
          where: dateFilter ? { date: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            date: true,
            doneAt: true,
            createdAt: true,
            gender: true,
            weightTier: true,
            status: true,
            inputCount: true,
            qualifiedCount: true,
            lossCount: true,
            machine: { select: { name: true, code: true } },
            bundleBatch: {
              select: {
                code: true,
                sourceBatch: { select: { code: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),
    // 保鲜冷库查询 (ledger7)
    !needColdLogs || isChannelViewer
      ? Promise.resolve([])
      : prisma.coldLog.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            code: true,
            createdAt: true,
            count: true,
            operator: true,
            store: { select: { name: true, code: true } },
            sortTask: {
              select: {
                code: true,
                gender: true,
                weightTier: true,
                bundleBatch: {
                  select: {
                    code: true,
                    sourceBatch: { select: { code: true } },
                  },
                },
              },
            },
            outboundLines: {
              where: { outboundOrder: { status: { not: "REJECTED" } } },
              select: { count: true },
            },
            outboundLosses: {
              where: { status: { not: "REJECTED" } },
              select: { count: true, lossType: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
    // 出库单查询 (ledger8, ledger9)
    !needOutboundOrders
      ? Promise.resolve([])
      : prisma.outboundOrder.findMany({
          where: {
            status: { not: "REJECTED" },
            ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}),
            ...(dateFilter
              ? {
                  OR: [
                    { createdAt: dateFilter },
                    { outboundTime: dateFilter },
                    { approvedAt: dateFilter },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            code: true,
            type: true,
            outboundCount: true,
            createdAt: true,
            outboundTime: true,
            approvedAt: true,
            transportCompany: true,
            logisticsNo: true,
            contactName: true,
            contactPhone: true,
            store: { select: { name: true } },
            channel: { select: { name: true } },
            applicant: { select: { fullName: true } },
            approver: { select: { fullName: true } },
            lines: {
              select: {
                gender: true,
                weightTier: true,
                count: true,
                coldLog: {
                  select: {
                    code: true,
                    sortTask: {
                      select: {
                        code: true,
                        bundleBatch: {
                          select: {
                            code: true,
                            lines: {
                              select: {
                                gender: true,
                                weightTier: true,
                                pool: { select: { code: true } },
                              },
                            },
                            sourceBatch: {
                              select: {
                                code: true,
                                pool: { select: { code: true } },
                                enclosure: { select: { code: true } },
                                farmer: {
                                  select: {
                                    name: true,
                                    enclosures: { select: { code: true } },
                                  },
                                },
                              },
                            },
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
    // 品控记录查询 (ledger10)
    !needQcRecords
      ? Promise.resolve([])
      : prisma.qCRecord.findMany({
          where: {
            ...(selectedCat ? { cat: selectedCat } : {}),
            ...(dateFilter ? { checkTime: dateFilter } : {}),
          },
          select: {
            id: true,
            code: true,
            checkTime: true,
            cat: true,
            formNo: true,
            uploader: true,
            result: true,
            conclusion: true,
            reason: true,
            fileUrl: true,
            fileName: true,
          },
          orderBy: { checkTime: "desc" },
        }),
    // 订单查询 (ledger11, ledger12)
    !needOrders
      ? Promise.resolve([])
      : prisma.order.findMany({
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
          select: {
            id: true,
            code: true,
            orderNo: true,
            type: true,
            status: true,
            gender: true,
            weightTier: true,
            count: true,
            deliveryDate: true,
            importTime: true,
            storeName: true,
            specModel: true,
            outboundLines: {
              where: { outboundOrder: { status: { not: "REJECTED" } } },
              select: {
                count: true,
                waybillNo: true,
                expressCompany: true,
                outboundOrder: {
                  select: {
                    code: true,
                    logisticsNo: true,
                    transportCompany: true,
                    store: { select: { name: true } },
                  },
                },
                coldLog: {
                  select: {
                    code: true,
                    sortTask: {
                      select: {
                        code: true,
                        bundleBatch: {
                          select: {
                            code: true,
                            sourceBatch: { select: { code: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ deliveryDate: "desc" }, { importTime: "desc" }],
        }),
    // 养殖户出库累计辅助查询 (仅 ledger1 需要)
    !needApprovedOutboundLines || isChannelViewer
      ? Promise.resolve([])
      : prisma.outboundLine.findMany({
          where: { outboundOrder: { status: "APPROVED" } },
          select: {
            count: true,
            coldLog: {
              select: {
                sortTask: {
                  select: {
                    bundleBatch: {
                      select: {
                        sourceBatch: {
                          select: { farmerId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
  ]);

  const shippedByFarmer = new Map<string, number>();
  if (needApprovedOutboundLines) {
    for (const line of allApprovedOutboundLines as any[]) {
      const farmerId = line.coldLog?.sortTask?.bundleBatch?.sourceBatch?.farmerId;
      if (farmerId) {
        shippedByFarmer.set(farmerId, (shippedByFarmer.get(farmerId) || 0) + line.count);
      }
    }
  }

  const farmerStatMap = new Map<string, { cumulativeBound: number; inPoolCount: number; quota: number }>();
  if (needTagClaims) {
    for (const f of farmers as any[]) {
      const bound = f.tagClaims?.reduce((s: number, c: any) => s + (c.boundCount || 0), 0) || 0;
      const inPool = f.batches?.reduce((s: number, b: any) => s + (b.inPoolCount || 0), 0) || 0;
      farmerStatMap.set(f.id, { cumulativeBound: bound, inPoolCount: inPool, quota: f.quota });
    }
  }

  const farmerRows = (validTab === "ledger1" ? farmers : []).map((farmer: any) => {
    let cumulativeClaimed = 0, cumulativeBound = 0, cumulativeScrapped = 0, cumulativeReturned = 0;
    for (const c of farmer.tagClaims) {
      cumulativeClaimed += c.claimCount;
      cumulativeBound += c.boundCount;
      cumulativeScrapped += c.scrappedCount;
      cumulativeReturned += c.returnedCount;
    }
    const cumulativeInPool = farmer.batches?.reduce((sum: number, batch: any) => sum + batch.inPoolCount, 0) || 0;
    const cumulativeOutbound = shippedByFarmer.get(farmer.id) || 0;
    const exportRow: ExportValue[] = [
      farmer.code,
      farmer.name,
      farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
      farmer.enclosures?.map((item: any) => item.code).join(", ") || "—",
      farmer.area,
      farmer.quota,
      cumulativeInPool,
      cumulativeClaimed,
      cumulativeBound,
      cumulativeScrapped,
      ...(SHOW_TAG_RETURN ? [cumulativeReturned] : []),
      cumulativeOutbound,
      Math.max(0, farmer.quota - cumulativeBound),
      farmer.creditRating || "A",
      cooperationText(farmer.status),
      farmer.contractUrl || farmer.contractName || "—",
    ];
    const displayRow = toDisplayRow(exportRow);
    if (farmer.contractUrl || farmer.contractName) {
      displayRow[displayRow.length - 1] = (
        <a href={getPreviewFileUrl(farmer.contractUrl, farmer.contractName || undefined)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
          {farmer.contractName || "查看附件"}
        </a>
      );
    }
    return { exportRow, displayRow };
  });

  const rawMaterialRows = (validTab === "ledger2" ? batches : []).flatMap((batch: any) => {
    const items = batch.items?.length
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
    return items.map((item: any) => {
      const itemTier = Invariants.normalizeWeightTier(item.weightTier);
      let downstreamShipped = 0;
      let downstreamProcessLoss = 0;
      let clearanceLoss = 0;
      let hasDownstream = false;

      if (batch.bundleBatches?.length) {
        for (const bb of batch.bundleBatches) {
          for (const line of bb.lines) {
            if (line.gender === item.gender && Invariants.normalizeWeightTier(line.weightTier) === itemTier) {
              hasDownstream = true;
              const lineLoss = line.lossCount ?? (bb.lines.length === 1 ? bb.lossCount : 0);
              downstreamProcessLoss += lineLoss || 0;
            }
          }
          for (const st of bb.sortTasks) {
            if (st.gender === item.gender && Invariants.normalizeWeightTier(st.weightTier) === itemTier) {
              hasDownstream = true;
              downstreamProcessLoss += st.lossCount || 0;
              for (const cl of st.coldLogs) {
                for (const ol of cl.outboundLines) {
                  downstreamShipped += ol.count || 0;
                }
                for (const loss of cl.outboundLosses) {
                  if (loss.lossType === "PACKAGING") downstreamProcessLoss += loss.count || 0;
                  else clearanceLoss += loss.count || 0;
                }
              }
            }
          }
        }
      }

      // 穿透后道工序：工艺损耗含包装损耗但不含清库损耗，总损耗再加清库损耗。
      const shipped = hasDownstream ? downstreamShipped : item.outPoolCount;
      const processLoss = hasDownstream ? item.lossCount + downstreamProcessLoss : item.lossCount;
      const totalLoss = processLoss + clearanceLoss;

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
        shipped,
        processLoss,
        rateText(processLoss, item.inPoolCount),
        totalLoss,
        rateText(totalLoss, item.inPoolCount),
        qcText(batch.quickCheck),
        qcText(batch.sampleCheck),
        batch.escort || "—",
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const tagClaimRows = (validTab === "ledger3" ? rawTagClaims : []).map((claim: any) => {
    const isRejected = claim.status === "REJECTED";
    const fStat = farmerStatMap.get(claim.farmerId) || {
      cumulativeBound: 0,
      inPoolCount: 0,
      quota: claim.farmer.quota,
    };
    const cumulativeBound = fStat.cumulativeBound;
    const tagInboundCount = fStat.inPoolCount;
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
      ...(SHOW_TAG_RETURN ? [isRejected ? 0 : claim.returnedCount] : []),
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

  const holdingPoolRows = (validTab === "ledger4" ? batches : []).flatMap((batch: any) => {
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
        batch.farmer?.enclosures?.map((e: any) => e.code).join(", ") || batch.enclosure?.code || "—",
        group.inCount,
        group.outCount,
        Math.max(0, group.inCount - group.outCount - group.lossCount),
        group.lossCount,
        rateText(group.lossCount, group.inCount),
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const bundlingRows = (validTab === "ledger5" ? bundleBatches : []).flatMap((batch: any) => {
    const lines = batch.lines?.length
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
    return lines.map((line: any) => {
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

  const sortingRows = (validTab === "ledger6" ? sortTasks : []).map((task: any) => {
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

  const coldRows = (validTab === "ledger7" ? coldLogs : []).map((log: any) => {
    const shipped = log.outboundLines?.reduce((sum: number, line: any) => sum + line.count, 0) || 0;
    const packagingLoss = log.outboundLosses?.reduce((sum: number, item: any) => sum + (item.lossType === "PACKAGING" ? item.count : 0), 0) || 0;
    const clearanceLoss = log.outboundLosses?.reduce((sum: number, item: any) => sum + (item.lossType === "PACKAGING" ? 0 : item.count), 0) || 0;
    const loss = packagingLoss + clearanceLoss;
    const exportRow: ExportValue[] = [
      formatDate(log.createdAt),
      formatTime(log.createdAt),
      log.code,
      log.store?.name || "—",
      log.store?.code || "—",
      log.sortTask?.bundleBatch?.sourceBatch?.code || "—",
      log.sortTask?.bundleBatch?.code || "—",
      log.sortTask?.code || "—",
      specText(log.sortTask?.gender, log.sortTask?.weightTier),
      log.count,
      shipped,
      packagingLoss,
      clearanceLoss,
      Math.max(0, log.count - shipped - loss),
      log.operator,
    ];
    return { exportRow, displayRow: exportRow as ReactNode[] };
  });

  const outboundHeaderRows = (validTab === "ledger8" ? outboundOrders : []).map((order: any) => {
    // 优先使用填写的业务出库时间；仅缺失时以历史审核时间或申请时间兜底。
    const actualOutTime = order.outboundTime || order.approvedAt || order.createdAt;
    const exportRow: ExportValue[] = [
      formatDate(order.createdAt),
      formatTime(order.createdAt),
      actualOutTime ? formatDateTime(actualOutTime) : "—",
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

  const outboundMatrixRows = (validTab === "ledger8" ? outboundOrders : []).map((order: any) => {
    const counts = new Map<string, number>();
    for (const line of order.lines || []) {
      const key = `${line.gender}_${normalizeWeightTier(line.weightTier)}`;
      counts.set(key, (counts.get(key) || 0) + line.count);
    }
    const destination = order.type === "CRAB_CARD" ? "蟹卡宅配" : `${order.channel?.name} / ${order.store?.name}`;
    return [
      order.code,
      destination,
      ...SPEC_MATRIX.map((item) => counts.get(`${item.gender}_${item.weightTier}`) || 0),
      order.outboundCount,
    ] as ExportValue[];
  });

  const outboundDetailRows = (validTab === "ledger9" ? outboundOrders : []).flatMap((order: any) => {
    const actualOutTime = order.outboundTime || order.approvedAt || order.createdAt;
    return (order.lines || []).map((line: any) => {
      const bundle = line.coldLog?.sortTask?.bundleBatch;
      const sourceBatch = bundle?.sourceBatch;
      const sourcePools = (bundle?.lines || [])
        .filter((item: any) => item.gender === line.gender && normalizeWeightTier(item.weightTier) === normalizeWeightTier(line.weightTier))
        .map((item: any) => item.pool?.code);
      const exportRow: ExportValue[] = [
        formatDate(order.createdAt),
        formatTime(order.createdAt),
        actualOutTime ? formatDateTime(actualOutTime) : "—",
        order.code,
        sourceBatch?.code || "—",
        bundle?.code || "—",
        line.coldLog?.sortTask?.code || "—",
        line.coldLog?.code || "—",
        specText(line.gender, line.weightTier),
        genderText(line.gender),
        line.count,
        Array.from(new Set(sourcePools)).filter(Boolean).join(", ") || sourceBatch?.pool?.code || "—",
        sourceBatch?.farmer?.name || "—",
        sourceBatch?.farmer?.enclosures?.map((e: any) => e.code).join(", ") || sourceBatch?.enclosure?.code || "—",
      ];
      return { exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const qcRows = (validTab === "ledger10" ? qcRecords : []).map((record: any) => {
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
    const displayRow = toDisplayRow(exportRow);
    if (record.fileUrl || record.fileName) {
      displayRow[8] = (
        <a href={getPreviewFileUrl(record.fileUrl, record.fileName || undefined)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
          {record.fileName || "查看附件"}
        </a>
      );
    }
    return { exportRow, displayRow };
  });

  const storeOrderRows = (validTab === "ledger11" ? orders : [])
    .filter((order: any) => order.type === "STORE_ORDER")
    .flatMap((order: any) => {
      const lines = order.outboundLines?.length ? order.outboundLines : [null];
      return lines.map((line: any) => {
        const task = line?.coldLog?.sortTask;
        const bundle = task?.bundleBatch;
        const exportRow: ExportValue[] = [
          formatDate(order.deliveryDate),
          order.code,
          formatDate(order.importTime),
          formatTime(order.importTime),
          order.orderNo,
          order.storeName || line?.outboundOrder?.store?.name || "—",
          specText(order.gender, order.weightTier),
          genderText(order.gender),
          line?.count ?? order.count,
          orderStatusText(order.status),
          line?.outboundOrder?.code || "—",
          bundle?.sourceBatch?.code || "—",
          bundle?.code || "—",
          task?.code || "—",
          line?.coldLog?.code || "—",
          line?.waybillNo || line?.outboundOrder?.logisticsNo || "—",
        ];
        return { exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const crabCardRows = (validTab === "ledger12" ? orders : [])
    .filter((order: any) => order.type === "CRAB_CARD")
    .flatMap((order: any) => {
      const lines = order.outboundLines?.length ? order.outboundLines : [null];
      return lines.map((line: any) => {
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
          line?.outboundOrder?.code || "—",
          line?.expressCompany || line?.outboundOrder?.transportCompany || "—",
          line?.waybillNo || "—",
          line?.waybillNo ? "—" : line?.outboundOrder?.logisticsNo || "—",
        ];
        return { exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const headers = {
    l1: ["编号", "姓名", "养殖类型", "围网", "面积(亩)", "年度额度(只)", "累计入池(只)", "累计领扣(只)", "累计绑扎(只)", "累计作废", ...(SHOW_TAG_RETURN ? ["累计回退"] : []), "累计出库(只)", "额度结余(只)", "信用评级", "合作状态", "合同附件"],
    l2: ["入库日期", "入库时间", "原料批次", "养殖户", "规格(两)", "公母", "只数", "斤数", "池名", "池号", "在池", "发货", "工艺损耗", "工艺损耗率", "总损耗", "总损耗率", "药残及重金属快检", "品质抽检", "跟车员"],
    l3: ["申领日期", "申领时间", "蟹扣批次", "蟹扣养殖户", "蟹扣入仓数", "申领数", "完成绑扎", "其中-已出库", "其中-后道损耗", ...(SHOW_TAG_RETURN ? ["退回"] : []), "作废", "差额", "轧平校验", "累计绑扎", "剩余额度", "申请人", "复核人", "审核状态"],
    l4: ["入池日期", "入池时间", "池名", "池号", "原料批次", "养殖户", "围网", "入池数量", "绑扎数量", "在池数量", "损耗(只)", "损耗率"],
    l5: ["捆扎日期", "捆扎时间", "捆扎批次", "班组", "班组编号", "原料批次", "蟹扣批次", "蟹绳批次", "养殖户", "池名", "池号", "规格", "状态", "公母", "初始捆扎只数", "捆扎完成只数", "损耗", "损耗率"],
    l6: ["分拣日期", "分拣时间", "分拣批次", "设备名", "设备编号", "原料批次", "绑扎批次", "规格", "公母", "状态", "投入(只)", "合格(只)", "损耗(只)", "损耗率"],
    l7: ["日期", "入库时间", "入库单号", "库名", "库位", "原料批次", "捆扎批次", "分拣任务", "规格", "入库(只)", "已发货(只)", "包装损耗(只)", "清库损耗(只)", "当前余量", "经手人"],
    l8: ["出库单申请日期", "申请时间", "出库时间", "出库批次", "出库类型", "合计数量(只)", "承运物流公司", "联系人", "联系方式", "出库申请人", "复核人"],
    l9: ["申请日期", "申请时间", "出库时间", "出库单号", "原料批次", "捆扎批次", "分拣任务", "预冷单", "规格", "公母", "数量(只)", "来源池", "养殖户", "围网"],
    l10: ["记录日期", "记录时间", "记录编号", "记录类型", "表格编号", "质检人员", "结论", "异常原因", "附件", "记录人"],
    l11: ["发货日期", "订单号", "导入日期", "导入时间", "原始单号", "门店", "规格", "公母", "只数", "订单状态", "出库单号", "原料批次", "捆扎批次", "分拣任务", "预冷单", "物流单号"],
    l12: ["发货日期", "订单号", "导入日期", "导入时间", "原始单号", "规格型号（原始）", "拆分规格", "公母", "只数", "订单状态", "出库单号", "快递公司", "物流单号", "备注"],
  };

  const ledgers = [
    { key: "ledger1", no: 1, label: "01 养殖户主档", title: "01 养殖户主档", sheet: "01 养殖户主档", headers: headers.l1, rows: farmerRows, count: validTab === "ledger1" ? farmerRows.length : countFarmers, empty: "暂无养殖户主档数据" },
    { key: "ledger2", no: 2, label: "02 原料批次", title: "02 原料批次台账", sheet: "02 原料批次台账", headers: headers.l2, rows: rawMaterialRows, count: validTab === "ledger2" ? rawMaterialRows.length : (countBatchItems > 0 ? countBatchItems : countBatches), empty: "暂无原料批次数据" },
    { key: "ledger3", no: 3, label: "03 蟹扣领用", title: "03 蟹扣领用台账", sheet: "03 蟹扣领用台账", headers: headers.l3, rows: tagClaimRows, count: validTab === "ledger3" ? tagClaimRows.length : countTagClaims, empty: "暂无蟹扣领用数据" },
    { key: "ledger4", no: 4, label: "04 暂养池流水", title: "04 暂养池流水", sheet: "04 暂养池流水", headers: headers.l4, rows: holdingPoolRows, count: validTab === "ledger4" ? holdingPoolRows.length : countBatches, empty: "暂无暂养池流水" },
    { key: "ledger5", no: 5, label: "05 捆扎作业", title: "05 捆扎作业台账", sheet: "05 捆扎作业台账", headers: headers.l5, rows: bundlingRows, count: validTab === "ledger5" ? bundlingRows.length : (countBundleLines > 0 ? countBundleLines : countBundleBatches), empty: "暂无捆扎作业数据" },
    { key: "ledger6", no: 6, label: "06 分拣作业", title: "06 分拣作业台账", sheet: "06 分拣作业台账", headers: headers.l6, rows: sortingRows, count: validTab === "ledger6" ? sortingRows.length : countSortTasks, empty: "暂无分拣作业数据" },
    { key: "ledger7", no: 7, label: "07 保鲜预冷", title: "07 保鲜预冷台账", sheet: "07 保鲜预冷台账", headers: headers.l7, rows: coldRows, count: validTab === "ledger7" ? coldRows.length : countColdLogs, empty: "暂无保鲜预冷数据" },
    { key: "ledger8", no: 8, label: "08 出库单", title: "08 出库单", sheet: "08 出库单", headers: headers.l8, rows: outboundHeaderRows, count: validTab === "ledger8" ? outboundHeaderRows.length : countOutboundOrders, empty: "暂无出库单数据" },
    { key: "ledger9", no: 9, label: "09 出库明细", title: "09 出库明细", sheet: "09 出库明细", headers: headers.l9, rows: outboundDetailRows, count: validTab === "ledger9" ? outboundDetailRows.length : countOutboundLines, empty: "暂无出库明细" },
    { key: "ledger10", no: 10, label: "10 品控记录", title: "10 品控记录表", sheet: "10 品控记录表", headers: headers.l10, rows: qcRows, count: validTab === "ledger10" ? qcRows.length : countQcRecords, empty: "暂无品控记录" },
    { key: "ledger11", no: 11, label: "11 门店订单", title: "11 门店订单台账", sheet: "11 门店订单台账", headers: headers.l11, rows: storeOrderRows, count: validTab === "ledger11" ? storeOrderRows.length : countStoreOrders, empty: "暂无门店订单数据" },
    { key: "ledger12", no: 12, label: "12 提蟹订单", title: "12 提蟹订单台账", sheet: "12 提蟹订单台账", headers: headers.l12, rows: crabCardRows, count: validTab === "ledger12" ? crabCardRows.length : countCrabCardOrders, empty: "暂无提蟹订单数据" },
  ];

  const totalLedgerRecords = ledgers.reduce((acc, l) => acc + l.count, 0);

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
            count: l.count,
          }))}
        />

        {ledgers.map((ledger) => {
          const isCurrentTab = ledger.key === validTab;
          const page = pageFor(ledger.no);
          const pageSize = pageSizeFor(ledger.no);
          const pagedRows = isCurrentTab ? paginate(ledger.rows, page, pageSize) : [];
          const exportRows = isCurrentTab ? ledger.rows.map((row) => row.exportRow) : [];
          const isOutboundHeader = ledger.no === 8;
          const matrixHeaders = ["出库批次", "礼卡/门店名称", ...SPEC_MATRIX.map((item) => item.header), "合计"];
          const pagedOutboundMatrixRows = isOutboundHeader && isCurrentTab ? paginate(outboundMatrixRows, page, pageSize) : [];
          const exportSections = isOutboundHeader && isCurrentTab
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
                total={ledger.count}
                page={page}
                pageSize={pageSize}
                pageParam={`l${ledger.no}Page`}
                pageSizeParam={`l${ledger.no}PageSize`}
              >
                {isCurrentTab ? (
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
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">点击上方标签即可加载该台账明细…</div>
                )}
              </LedgerCardSection>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
