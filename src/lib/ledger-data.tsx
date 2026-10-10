import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getLedgerRange } from "./ledger-range";
import { prisma } from "@/lib/prisma";
import type { ExportValue } from "@/lib/excel";
import { Invariants } from "@/lib/invariants";
import { calculateFarmerLedger, getFarmerLedgerRows } from "@/lib/farmer-ledger";
import { calculateTagClaimLedger, getTagClaimLedgerHeaders } from "@/lib/tag-claim-ledger";
import { SHOW_TAG_RETURN } from "@/lib/feature-flags";
import { formatDate, formatTime, formatDateTime, getBeijingDayRange, getPreviewFileUrl, formatOrderCode } from "@/lib/utils";
import { getLedgerRowPage, ledgerNumber, ledgerPaging, type LedgerParams } from "./ledger-pagination";
import type { ReactNode } from "react";
const toDisplayRow = (row: ExportValue[]): ReactNode[] => row.map((v) => v as ReactNode);
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

export async function getLedgerData(params: LedgerParams, exportAll = false) {
  const currentUser = await getCurrentUser();
  const range = getLedgerRange(params);
  const no = ledgerNumber(params);
  const validTab = `ledger${no}`;
  const selectedDateStr = `${range.start} 至 ${range.end}`;
  const selectedCat = params.cat?.trim();
  const dateFilter = range.filter;
  const isChannelViewer = currentUser.role === "CHANNEL_VIEWER";
  const channelId = currentUser.channelId;
  const rowPage = await getLedgerRowPage(prisma, no, params, currentUser, exportAll);
  const parentIds = [...new Set(rowPage.rows.map((row) => row.parentId))];
  const rowKeys = rowPage.rows.map((row) => row.rowKey);
  const [farmers, rawTagClaims, batches, bundleBatches, sortTasks, coldLogs, outboundOrders, qcRecords, orders] = await Promise.all([
    // 养殖户查询 (ledger1 或 ledger3)
    isChannelViewer || (validTab !== "ledger1" && validTab !== "ledger3")
      ? []
      : validTab === "ledger1"
      ? getFarmerLedgerRows(prisma, parentIds)
      : prisma.farmer.findMany({
          where: { tagClaims: { some: { id: { in: parentIds } } } },
          select: {
            id: true,
            batches: { select: { inPoolCount: true, inPoolTime: true } },
            tagClaims: {
              where: { status: "APPROVED" },
              select: { boundCount: true },
            },
          },
        }),
    // 蟹扣申领查询 (ledger3)
    isChannelViewer || validTab !== "ledger3"
      ? []
      : prisma.tagClaim.findMany({
          where: { id: { in: parentIds } },
          select: {
            id: true,
            code: true,
            claimDate: true,
            approvedAt: true,
            claimCount: true,
            scrappedCount: true,
            returnedCount: true,
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
                status: true,
                doneAt: true,
                qualifiedCount: true,
                sortTasks: {
                  select: {
                    coldLogs: {
                      select: {
                        outboundLines: {
                          where: { outboundOrder: { status: { not: "REJECTED" } } },
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
    isChannelViewer || (validTab !== "ledger2" && validTab !== "ledger4")
      ? []
      : validTab === "ledger2"
      ? prisma.batch.findMany({
          where: { id: { in: parentIds } },
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
              where: { id: { in: rowKeys } },
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
          where: { id: { in: parentIds } },
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
    isChannelViewer || validTab !== "ledger5"
      ? []
      : prisma.bundleBatch.findMany({
          where: { id: { in: parentIds } },
          select: {
            id: true,
            code: true,
            date: true,
            doneAt: true,
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
              where: { id: { in: rowKeys } },
              select: {
                id: true,
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
    isChannelViewer || validTab !== "ledger6"
      ? []
      : prisma.sortTask.findMany({
          where: { id: { in: parentIds } },
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
    isChannelViewer || validTab !== "ledger7"
      ? []
      : prisma.coldLog.findMany({
          where: { id: { in: parentIds } },
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
    validTab !== "ledger8" && validTab !== "ledger9"
      ? []
      : prisma.outboundOrder.findMany({
          where: {
            id: { in: parentIds },
            status: { not: "REJECTED" },
            ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}),
            OR: [
              { createdAt: dateFilter },
              { outboundTime: dateFilter },
              { approvedAt: dateFilter },
            ],
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
              ...(validTab === "ledger9" ? { where: { id: { in: rowKeys } } } : {}),
              select: {
                id: true,
                gender: true,
                weightTier: true,
                count: true,
                coldLog: validTab === "ledger9" ? {
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
                                pool: { select: { name: true, code: true } },
                              },
                            },
                            sourceBatch: {
                              select: {
                                code: true,
                                pool: { select: { name: true, code: true } },
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
                } : false,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
    // 品控记录查询 (ledger10)
    validTab !== "ledger10"
      ? []
      : prisma.qCRecord.findMany({
          where: {
            id: { in: parentIds },
            ...(selectedCat ? { cat: selectedCat } : {}),
            checkTime: dateFilter,
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
    validTab !== "ledger11" && validTab !== "ledger12"
      ? []
      : prisma.order.findMany({
          where: {
            id: { in: parentIds },
            type: validTab === "ledger12" ? "CRAB_CARD" : "STORE_ORDER",
            deliveryDate: dateFilter,
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
              where: { id: { in: rowKeys }, outboundOrder: { status: { not: "REJECTED" }, ...(isChannelViewer ? { channelId: channelId || "__NO_CHANNEL__" } : {}) } },
              select: {
                id: true,
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
  ]);
  const farmerStatMap = new Map<string, number>();
  if (validTab === "ledger3") {
    for (const f of farmers as any[]) {
      const bound = f.tagClaims?.reduce((s: number, c: any) => s + (c.boundCount || 0), 0) || 0;
      farmerStatMap.set(f.id, bound);
    }
  }

  const farmerRows = (validTab === "ledger1" ? farmers : []).map((farmer: any) => {
    const {
      cumulativeInPool, cumulativeClaimed, cumulativeBound, cumulativeReturned,
      holdingLoss, totalLoss, cumulativeOutbound, remainingQuota,
    } = calculateFarmerLedger(farmer);
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
      holdingLoss,
      ...(SHOW_TAG_RETURN ? [cumulativeReturned] : []),
      totalLoss,
      cumulativeOutbound,
      remainingQuota,
      farmer.creditRating || "A",
      cooperationText(farmer.status),
      farmer.contractUrl || farmer.contractName || "—",
    ];
    const displayRow = toDisplayRow(exportRow);
    if (remainingQuota < 0) {
      displayRow[exportRow.length - 4] = <span className="text-destructive font-medium">{remainingQuota}</span>;
    }
    if (farmer.contractUrl || farmer.contractName) {
      displayRow[displayRow.length - 1] = (
        <a href={getPreviewFileUrl(farmer.contractUrl, farmer.contractName || undefined)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
          {farmer.contractName || "查看附件"}
        </a>
      );
    }
    return { rowKey: farmer.id, exportRow, displayRow };
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
      return { rowKey: item.id === `${batch.id}-fallback` ? batch.id : item.id, exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const siblingClaims = validTab === "ledger3" ? await prisma.tagClaim.findMany({
    where: { OR: rawTagClaims.map((claim) => ({ farmerId: claim.farmerId, claimDate: getBeijingDayRange(formatDate(claim.claimDate)) })) },
    select: { id: true, farmerId: true, claimDate: true, claimCount: true, status: true },
  }) : [];
  const showTagLedgerReturns = SHOW_TAG_RETURN || (validTab === "ledger3" && await prisma.tagClaim.count({ where: { claimDate: dateFilter, returnedCount: { gt: 0 } } }) > 0);
  const tagClaimMetrics = calculateTagClaimLedger(validTab === "ledger3" ? farmers as any[] : [], [...rawTagClaims, ...siblingClaims.filter((claim) => !parentIds.includes(claim.id)).map((claim) => ({ ...claim, returnedCount: 0, scrappedCount: 0, bundleBatches: [] }))]);
  const tagClaimRows = rawTagClaims.map((claim: any, index: number) => {
    const isRejected = claim.status === "REJECTED";
    const cumulativeBound = farmerStatMap.get(claim.farmerId) || 0;
    const metrics = tagClaimMetrics[index];

    const { outboundCount } = Invariants.getClaimDownstreamMetrics({
      boundCount: metrics.dailyBound,
      bundleBatches: claim.bundleBatches.filter((batch: any) =>
        batch.status === "COMPLETED" && batch.doneAt && formatDate(batch.doneAt) === formatDate(claim.claimDate)),
    });

    const exportRow: ExportValue[] = [
      formatDate(claim.claimDate),
      formatTime(claim.claimDate),
      claim.code || "—",
      claim.farmer.name,
      metrics.dailyInbound,
      isRejected ? 0 : claim.claimCount,
      metrics.dailyBound,
      isRejected ? 0 : outboundCount,
      ...(showTagLedgerReturns ? [isRejected ? 0 : claim.returnedCount] : []),
      isRejected ? 0 : claim.scrappedCount,
      metrics.difference,
      metrics.balanceStatus,
      isRejected ? 0 : cumulativeBound,
      isRejected ? claim.farmer.quota : Math.max(0, claim.farmer.quota - cumulativeBound),
      claim.applicant?.fullName || "—",
      claim.approver?.fullName || "—",
      claim.status === "PENDING" ? "—" : claim.approvedAt ? formatDateTime(claim.approvedAt) : "—",
      claimStatusText(claim.status),
      metrics.inboundStatus,
    ];
    const displayRow = toDisplayRow(exportRow);
    if (metrics.difference !== 0) {
      const diffIndex = showTagLedgerReturns ? 10 : 9;
      displayRow[diffIndex] = <span className="text-destructive font-medium">{metrics.difference}</span>;
    }
    if (metrics.inboundStatus === "当日申领超过当日入仓") {
      displayRow[displayRow.length - 1] = <span className="text-destructive font-medium">{metrics.inboundStatus}（合计 {metrics.dailyClaimed}）</span>;
    }
    return { rowKey: claim.id, exportRow, displayRow };
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
      return { rowKey: `${batch.id}:${group.poolCode}`, exportRow, displayRow: exportRow as ReactNode[] };
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
        batch.status === "COMPLETED" && batch.doneAt ? formatDateTime(batch.doneAt) : "—",
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
        line.count,
        batch.status === "COMPLETED" ? qualified : "—",
        batch.status === "COMPLETED" ? loss : "—",
        batch.status === "COMPLETED" ? rateText(loss, line.count) : "—",
      ];
      return { rowKey: line.id === `${batch.id}-fallback` ? batch.id : line.id, exportRow, displayRow: exportRow as ReactNode[] };
    });
  });

  const sortingRows = (validTab === "ledger6" ? sortTasks : []).map((task: any) => {
    const exportRow: ExportValue[] = [
      formatDate(task.date),
      formatTime(task.date),
      task.status === "COMPLETED" && task.doneAt ? formatDateTime(task.doneAt) : "—",
      task.code,
      task.machine.name || "—",
      task.machine.code,
      task.bundleBatch.sourceBatch.code,
      task.bundleBatch.code,
      specText(task.gender, task.weightTier),
      task.status === "COMPLETED" ? "已完成" : "待分拣",
      task.inputCount,
      task.status === "COMPLETED" ? task.qualifiedCount : 0,
      task.status === "COMPLETED" ? task.lossCount : 0,
      task.status === "COMPLETED" ? rateText(task.lossCount, task.inputCount) : "—",
    ];
    return { rowKey: task.id, exportRow, displayRow: exportRow as ReactNode[] };
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
    return { rowKey: log.id, exportRow, displayRow: exportRow as ReactNode[] };
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
      order.type === "STORE_ORDER" ? "苏州陆路通航空货运有限公司" : order.transportCompany || (order.logisticsNo === "门店冷链专车自配" ? order.logisticsNo : "—"),
      order.contactName || "—",
      order.contactPhone || "—",
      order.applicant?.fullName || "—",
      order.approver?.fullName || "—",
    ];
    return { rowKey: order.id, exportRow, displayRow: exportRow as ReactNode[] };
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
        .map((item: any) => item.pool)
        .filter(Boolean);
      const uniquePools = Array.from(new Map<string, { name: string; code: string }>(
        sourcePools.map((pool: { name: string; code: string }) => [pool.code, pool]),
      ).values());
      const pools = uniquePools.length ? uniquePools : sourceBatch?.pool ? [sourceBatch.pool] : [];
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
        line.count,
        pools.map((pool: { name: string; code: string }) => pool.name || pool.code).join(", ") || "—",
        pools.map((pool: { code: string }) => pool.code).join(", ") || "—",
        sourceBatch?.farmer?.name || "—",
        sourceBatch?.farmer?.enclosures?.map((e: any) => e.code).join(", ") || sourceBatch?.enclosure?.code || "—",
      ];
      return { rowKey: line.id, exportRow, displayRow: exportRow as ReactNode[] };
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
    return { rowKey: record.id, exportRow, displayRow };
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
          formatDate(order.importTime),
          formatTime(order.importTime),
          order.orderNo,
          order.storeName || line?.outboundOrder?.store?.name || "—",
          specText(order.gender, order.weightTier),
          line?.count ?? order.count,
          orderStatusText(order.status),
          line?.outboundOrder?.code || "—",
          bundle?.sourceBatch?.code || "—",
          bundle?.code || "—",
          task?.code || "—",
          line?.coldLog?.code || "—",
          "苏州陆路通航空货运有限公司",
        ];
        return { rowKey: line?.id || order.id, exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const crabCardRows = (validTab === "ledger12" ? orders : [])
    .filter((order: any) => order.type === "CRAB_CARD")
    .flatMap((order: any) => {
      const lines = order.outboundLines?.length ? order.outboundLines : [null];
      return lines.map((line: any) => {
        const exportRow: ExportValue[] = [
          formatDate(order.deliveryDate),
          formatOrderCode(order.code),
          formatDate(order.importTime),
          formatTime(order.importTime),
          order.orderNo,
          order.specModel || "—",
          specText(order.gender, order.weightTier),
          line?.count ?? order.count,
          orderStatusText(order.status),
          line?.outboundOrder?.code || "—",
          line?.expressCompany || line?.outboundOrder?.transportCompany || "—",
          line?.waybillNo || "—",
          line?.waybillNo ? "—" : line?.outboundOrder?.logisticsNo || "—",
        ];
        return { rowKey: line?.id || order.id, exportRow, displayRow: exportRow as ReactNode[] };
      });
    });

  const headers = {
    l1: ["编号", "姓名", "养殖类型", "围网", "面积(亩)", "年度额度(只)", "累计入池(只)", "累计领扣(只)", "累计绑扎(只)", "暂养损耗", ...(SHOW_TAG_RETURN ? ["累计回退"] : []), "累计损耗(只)", "累计出库(只)", "额度结余(只)", "信用评级", "合作状态", "合同附件"],
    l2: ["入池日期", "入池时间", "原料批次", "养殖户", "规格(两)", "公母", "只数", "斤数", "池名", "池号", "在池", "发货", "工艺损耗", "工艺损耗率", "总损耗", "总损耗率", "药残及重金属快检", "品质抽检", "跟车员"],
    l3: getTagClaimLedgerHeaders(showTagLedgerReturns),
    l4: ["入池日期", "入池时间", "池名", "池号", "原料批次", "养殖户", "围网", "入池数量", "绑扎数量", "在池数量", "暂养损耗", "损耗率"],
    l5: ["捆扎日期", "捆扎完成时间", "捆扎批次", "班组", "班组编号", "原料批次", "蟹扣批次", "蟹绳批次", "养殖户", "池名", "池号", "规格", "状态", "初始捆扎只数", "捆扎完成只数", "捆扎加工损耗", "损耗率"],
    l6: ["分拣日期", "分拣时间", "分拣完成时间", "分拣批次", "设备名", "设备编号", "原料批次", "绑扎批次", "规格", "状态", "初始分拣只数", "分拣完成只数", "机器分拣损耗(只)", "损耗率"],
    l7: ["日期", "入库时间", "入库单号", "库名", "库位", "原料批次", "捆扎批次", "分拣任务", "规格", "入库(只)", "已发货(只)", "包装损耗(只)", "清库损耗(只)", "当前余量", "经手人"],
    l8: ["出库单申请日期", "申请时间", "出库时间", "出库批次", "出库类型", "合计数量(只)", "承运物流公司", "联系人", "联系方式", "出库申请人", "复核人"],
    l9: ["申请日期", "申请时间", "出库时间", "出库单号", "原料批次", "捆扎批次", "分拣任务", "预冷单", "规格", "数量(只)", "来源池名", "来源池编号", "养殖户", "围网"],
    l10: ["记录日期", "记录时间", "记录编号", "记录类型", "表格编号", "质检人员", "结论", "异常原因", "附件", "记录人"],
    l11: ["发货日期", "导入日期", "导入时间", "原始单号", "门店", "规格", "只数", "订单状态", "出库单号", "原料批次", "捆扎批次", "分拣任务", "预冷单", "物流"],
    l12: ["发货日期", "订单号", "导入日期", "导入时间", "原始单号", "规格型号（原始）", "拆分规格", "只数", "订单状态", "出库单号", "快递公司", "物流单号", "备注"],
  };

  const ledgers = [
    { key: "ledger1", no: 1, label: "01 养殖户主档", title: "01 养殖户主档", sheet: "01 养殖户主档", headers: headers.l1, rows: farmerRows, count: rowPage.total, empty: "暂无养殖户主档数据" },
    { key: "ledger2", no: 2, label: "02 原料批次", title: "02 原料批次台账", sheet: "02 原料批次台账", headers: headers.l2, rows: rawMaterialRows, count: rowPage.total, empty: "暂无原料批次数据" },
    { key: "ledger3", no: 3, label: "03 蟹扣领用", title: "03 蟹扣领用台账", sheet: "03 蟹扣领用台账", headers: headers.l3, rows: tagClaimRows, count: rowPage.total, empty: "暂无蟹扣领用数据" },
    { key: "ledger4", no: 4, label: "04 暂养池流水", title: "04 暂养池流水", sheet: "04 暂养池流水", headers: headers.l4, rows: holdingPoolRows, count: rowPage.total, empty: "暂无暂养池流水" },
    { key: "ledger5", no: 5, label: "05 捆扎作业", title: "05 捆扎作业台账", sheet: "05 捆扎作业台账", headers: headers.l5, rows: bundlingRows, count: rowPage.total, empty: "暂无捆扎作业数据" },
    { key: "ledger6", no: 6, label: "06 分拣作业", title: "06 分拣作业台账", sheet: "06 分拣作业台账", headers: headers.l6, rows: sortingRows, count: rowPage.total, empty: "暂无分拣作业数据" },
    { key: "ledger7", no: 7, label: "07 保鲜预冷", title: "07 保鲜预冷台账", sheet: "07 保鲜预冷台账", headers: headers.l7, rows: coldRows, count: rowPage.total, empty: "暂无保鲜预冷数据" },
    { key: "ledger8", no: 8, label: "08 出库单", title: "08 出库单", sheet: "08 出库单", headers: headers.l8, rows: outboundHeaderRows, count: rowPage.total, empty: "暂无出库单数据" },
    { key: "ledger9", no: 9, label: "09 出库明细", title: "09 出库明细", sheet: "09 出库明细", headers: headers.l9, rows: outboundDetailRows, count: rowPage.total, empty: "暂无出库明细" },
    { key: "ledger10", no: 10, label: "10 品控记录", title: "10 品控记录表", sheet: "10 品控记录表", headers: headers.l10, rows: qcRows, count: rowPage.total, empty: "暂无品控记录" },
    { key: "ledger11", no: 11, label: "11 门店订单", title: "11 门店订单台账", sheet: "11 门店订单台账", headers: headers.l11, rows: storeOrderRows, count: rowPage.total, empty: "暂无门店订单数据" },
    { key: "ledger12", no: 12, label: "12 提蟹订单", title: "12 提蟹订单台账", sheet: "12 提蟹订单台账", headers: headers.l12, rows: crabCardRows, count: rowPage.total, empty: "暂无提蟹订单数据" },
  ];

  const ledger = ledgers[no - 1];
  const byKey = new Map(ledger.rows.map((row) => [row.rowKey, row]));
  const rows = rowPage.rows.map((row) => byKey.get(row.rowKey)).filter((row): row is NonNullable<typeof row> => !!row);
  const matrixById = new Map(outboundOrders.map((order, index) => [order.id, outboundMatrixRows[index]]));
  const matrixRows = no === 8 ? rowPage.rows.map((row) => matrixById.get(row.parentId)!) : [];
  const activeLedger = { ...ledger, rows };
  return { ledgers: ledgers.map((item) => item.no === no ? activeLedger : { ...item, rows: [] }),
    outboundMatrixRows: matrixRows, validTab, selectedDateStr, range, showTagLedgerReturns,
    currentPage: rowPage.page,
    pageSizeFor: (index: number) => ledgerPaging(params, index).pageSize,
    matrixHeaders: ["出库批次", "礼卡/门店名称", ...SPEC_MATRIX.map((item) => item.header), "合计"] };
}
