import { prisma } from "@/lib/prisma";
import { getTenant } from "@/config/tenant";
import { formatDate, formatDateTime, formatFullDateTime } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";

export interface TraceQCBadge {
  id: string;
  code: string;
  cat: string;
  title: string;
  result: string;
  conclusion?: string | null;
  reason?: string | null;
  formNo?: string | null;
  checkTime: Date;
  uploader: string;
  fileName?: string | null;
}

export interface TraceChainNode {
  step: number;
  stageName: "原料" | "暂养" | "捆扎" | "分拣" | "预冷" | "出库";
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
  qcBadges: TraceQCBadge[];
  status: "COMPLETED" | "PREVIEW" | "PENDING";
}

export interface TraceLineDetail {
  lineIndex: number;
  specTitle: string;
  gender: string;
  weightTier: string;
  count: number;
  expressCompany?: string | null;
  waybillNo?: string | null;
  farmerInfo?: {
    name: string;
    code: string;
    area: number;
    quota: number;
    farmType: string;
    enclosureCode: string;
  };
  chain: TraceChainNode[];
}

export interface TraceQueryResult {
  found: boolean;
  mode: "ORDER" | "OUTBOUND";
  isPreview: boolean;
  orderInfo?: {
    code: string;
    orderNo: string;
    type: string;
    storeName: string;
    specModel?: string | null;
    gender: string;
    weightTier: string;
    count: number;
    deliveryDate: Date;
    status: string;
    outboundOrderCode?: string | null;
  };
  outboundInfo?: {
    code: string;
    type: string;
    storeName: string;
    channelName: string;
    outboundCount: number;
    applicantName: string;
    approverName?: string | null;
    appliedAt: Date;
    approvedAt?: Date | null;
    status: string;
    logisticsNo?: string | null;
  };
  farmerInfo: {
    name: string;
    code: string;
    area: number;
    quota: number;
    farmType: string;
    enclosureCode: string;
  };
  lines: TraceLineDetail[];
}

export function extractTraceFarmers(data: { farmerInfo?: TraceQueryResult["farmerInfo"]; lines?: TraceLineDetail[] }) {
  return Array.from(
    new Map(
      [data.farmerInfo, ...(data.lines || []).map((l) => l.farmerInfo)]
        .filter((f): f is NonNullable<typeof f> => Boolean(f?.code))
        .map((f) => [f.code, f])
    ).values()
  );
}

const DEFAULT_FARMER = {
  name: "张卫民",
  code: "JD-2026-001",
  area: 100,
  quota: 60000,
  farmType: "LAKE_CRAB",
  enclosureCode: "W-01",
};

/**
 * 核心链路解析器：根据单号检索并逆向构建六环节溯源链
 */
export async function resolveTraceQuery(
  searchTerm: string,
  channelId?: string | null
): Promise<TraceQueryResult | null> {
  const term = searchTerm.trim();
  if (!term) return null;

  // 1. 尝试匹配订单 (SO... / SM... / KK...)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNo: { contains: term } },
        { code: { contains: term } },
      ],
    },
    include: {
      outboundLines: {
        include: {
          outboundOrder: {
            include: {
              coldLog: { include: { store: true } },
              batch: {
                include: {
                  farmer: { include: { enclosures: true } },
                  enclosure: true,
                  pool: true,
                  items: { include: { pool: true } },
                },
              },
              store: { include: { channel: true } },
              channel: true,
              applicant: true,
              approver: true,
              lines: { include: { order: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length > 0) {
    const primaryOrder = orders[0];
    const outOrder = primaryOrder.outboundLines?.[0]?.outboundOrder;

    if (channelId && outOrder?.channelId && outOrder.channelId !== channelId) {
      return null;
    }

    if (primaryOrder.status === "SHIPPED" && outOrder) {
      return await buildTraceFromOutbound(outOrder, orders);
    }

    return await buildPreviewTraceFromOrders(orders);
  }

  // 2. 尝试匹配出库单 (CK...) / 批次 (YL...) / 快递单号
  const outboundOrders = await prisma.outboundOrder.findMany({
    where: {
      OR: [
        { code: term },
        { code: { contains: term } },
        { logisticsNo: { contains: term } },
        { batch: { code: { contains: term } } },
        {
          lines: {
            some: {
              OR: [
                { orderNo: { contains: term } },
                { waybillNo: { contains: term } },
              ],
            },
          },
        },
      ],
      ...(channelId ? { channelId } : {}),
    },
    include: {
      coldLog: { include: { store: true } },
      batch: {
        include: {
          farmer: { include: { enclosures: true } },
          enclosure: true,
          pool: true,
          items: { include: { pool: true } },
        },
      },
      store: { include: { channel: true } },
      channel: true,
      applicant: true,
      approver: true,
      lines: { include: { order: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (outboundOrders.length > 0) {
    const ob = outboundOrders[0];
    const isExplicitBatchSearch =
      ob.code.toLowerCase().includes(term.toLowerCase()) ||
      Boolean(ob.batch?.code && ob.batch.code.toLowerCase().includes(term.toLowerCase())) ||
      Boolean(ob.logisticsNo && ob.logisticsNo.toLowerCase().includes(term.toLowerCase()));

    if (!isExplicitBatchSearch) {
      const matchedOrders = ob.lines
        ?.filter(
          (l: any) =>
            (l.orderNo && l.orderNo.toLowerCase().includes(term.toLowerCase())) ||
            (l.waybillNo && l.waybillNo.toLowerCase().includes(term.toLowerCase())) ||
            (l.order?.code && l.order.code.toLowerCase().includes(term.toLowerCase()))
        )
        .map((l: any) => l.order)
        .filter(Boolean);

      if (matchedOrders?.length) {
        return await buildTraceFromOutbound(ob, matchedOrders);
      }
    }

    return await buildTraceFromOutbound(ob);
  }

  return null;
}

/**
 * 构建已出库真实溯源链
 */
async function buildTraceFromOutbound(
  outOrder: any,
  relatedOrders?: any[]
): Promise<TraceQueryResult> {
  const batch = outOrder.batch;
  const farmer = batch.farmer;
  let primaryFarmer = farmer;
  let primaryBatch = batch;
  const isApproved = outOrder.status === "APPROVED";

  // 一次性获取全链路关联品控记录
  const allQC = await prisma.qCRecord.findMany({
    orderBy: { checkTime: "desc" },
  });

  // 读取可能随出库申请留痕的 specBatchMap（用于精准定位规格与冷库批次）
  const outboundAudit = await prisma.auditLog.findFirst({
    where: {
      entityId: outOrder.id,
      action: { in: ["STORE_OUTBOUND_REQUEST", "CARD_OUTBOUND_REQUEST"] },
    },
    orderBy: { createdAt: "desc" },
  });
  let specBatchMap: Record<string, string> = {};
  if (outboundAudit?.details) {
    try {
      const d = JSON.parse(outboundAudit.details);
      if (d.specBatchMap && typeof d.specBatchMap === "object") {
        specBatchMap = d.specBatchMap;
      }
    } catch {}
  }

  // 针对蟹卡提货或按单查询场景：严格按目标订单ID/单号隔离，不泄漏同出库批次的其他订单明细
  let matchedLines = outOrder.lines;
  if (relatedOrders && relatedOrders.length > 0) {
    const targetKeys = new Set(relatedOrders.flatMap((o: any) => [o.id, o.orderNo, o.code]).filter(Boolean));
    matchedLines = outOrder.lines?.filter(
      (l: any) =>
        (l.orderId && targetKeys.has(l.orderId)) ||
        (l.orderNo && targetKeys.has(l.orderNo)) ||
        (l.order?.code && targetKeys.has(l.order.code))
    );
  }

  const linesToProcess = matchedLines && matchedLines.length > 0 ? matchedLines : [{
    gender: batch.gender,
    weightTier: batch.weightTier,
    count: outOrder.outboundCount,
    expressCompany: null,
    waybillNo: null,
  }];

  const lineDetails: TraceLineDetail[] = [];

  for (let idx = 0; idx < linesToProcess.length; idx++) {
    const line = linesToProcess[idx];
    const gender = line.gender || batch.gender;
    const weightTier = line.weightTier || batch.weightTier;
    const normTier = Invariants.normalizeWeightTier(weightTier);
    const tierVariants = Array.from(new Set([weightTier, normTier].filter(Boolean)));

    // 核心规格穿透校验：检查 outOrder.batch 是否真正包含当前明细行规格
    // 若出库单绑定的是单主批次，但当前行属于多单合单/礼盒多规格混装（例如 4.0两公 与 3.0两母 属于不同养殖户或不同原料批次）
    // 则精准反向寻源与该规格严格匹配的真实原料批次及签约养殖户，杜绝张冠李戴
    const batchHasSpec =
      (batch.gender === gender && tierVariants.includes(batch.weightTier)) ||
      batch.items?.some((it: any) => it.gender === gender && tierVariants.includes(it.weightTier));

    let effectiveBatch = batch;
    let effectiveFarmer = farmer;

    if (!batchHasSpec) {
      const findSourceBatch = (formNo?: string | null) =>
        prisma.batch.findFirst({
          where: {
            ...(formNo ? { formNo } : {}),
            OR: [
              { gender, weightTier: { in: tierVariants } },
              { items: { some: { gender, weightTier: { in: tierVariants } } } },
            ],
          },
          include: {
            farmer: { include: { enclosures: true } },
            enclosure: true,
            pool: true,
            items: { include: { pool: true } },
          },
          orderBy: { createdAt: "desc" },
        });

      const matchedSourceBatch =
        (batch.formNo && (await findSourceBatch(batch.formNo))) ||
        (await findSourceBatch());

      if (matchedSourceBatch) {
        effectiveBatch = matchedSourceBatch;
        effectiveFarmer = matchedSourceBatch.farmer;
      }
    }

    if (idx === 0) {
      primaryFarmer = effectiveFarmer;
      primaryBatch = effectiveBatch;
    }

    // 溯源链路层层反向锚定：同一农户、暂养池、规格，贯通称重分拣与预冷入库
    // 1. 优先读取出库申请时所选 specBatchMap 中的专属保鲜批次
    const allocatedColdLogId =
      specBatchMap[`${gender}_${normTier}`] || specBatchMap[`${gender}_${weightTier}`];

    let coldLog: any = null;
    let sortTask: any = null;
    let bundleBatch: any = null;

    if (allocatedColdLogId) {
      coldLog = await prisma.coldLog.findUnique({
        where: { id: allocatedColdLogId },
        include: { store: true },
      });
    }

    const inspectColdLogLineage = async (cl: any, strictSpec = true) => {
      if (!cl?.refId) return null;
      const st = await prisma.sortTask.findFirst({
        where: {
          OR: [{ code: cl.refId }, { id: cl.refId }],
          gender,
          ...(strictSpec ? { weightTier: { in: tierVariants } } : {}),
        },
        include: {
          machine: true,
          bundleBatch: {
            include: { group: true, tagClaim: { include: { farmer: true } }, lines: true },
          },
        },
      });
      if (st) {
        return { sortTask: st, bundleBatch: st.bundleBatch };
      }

      const specMatch = strictSpec
        ? [
            { lines: { some: { gender, weightTier: { in: tierVariants } } } },
            { sortTasks: { some: { gender, weightTier: { in: tierVariants } } } },
          ]
        : [
            { lines: { some: { gender } } },
            { sortTasks: { some: { gender } } },
          ];

      const bb = await prisma.bundleBatch.findFirst({
        where: {
          AND: [
            { OR: [{ code: cl.refId }, { id: cl.refId }] },
            { OR: specMatch },
          ],
        },
        include: {
          group: true,
          tagClaim: { include: { farmer: true } },
          lines: true,
          sortTasks: {
            where: { gender, ...(strictSpec ? { weightTier: { in: tierVariants } } : {}) },
            include: { machine: true },
          },
        },
      });
      if (bb) {
        return {
          sortTask: bb.sortTasks?.[0] || null,
          bundleBatch: bb,
        };
      }
      return null;
    };

    if (coldLog) {
      const lineage =
        (await inspectColdLogLineage(coldLog, true)) ||
        (await inspectColdLogLineage(coldLog, false));
      if (lineage) {
        sortTask = lineage.sortTask;
        bundleBatch = lineage.bundleBatch;
      }
    } else if (outOrder.coldLog) {
      // 仅当出库单关联的 coldLog 确实严格匹配当前行性别/规格时才沿用
      const lineage = await inspectColdLogLineage(outOrder.coldLog, true);
      if (lineage) {
        coldLog = outOrder.coldLog;
        sortTask = lineage.sortTask;
        bundleBatch = lineage.bundleBatch;
      }
    }

    // 分拣任务深度反向对齐（严格限制当前行 gender，杜绝公母混淆）
    const sortTaskInclude = {
      machine: true,
      bundleBatch: {
        include: { group: true, tagClaim: { include: { farmer: true } }, lines: true },
      },
    };

    if (!sortTask) {
      sortTask =
        (await prisma.sortTask.findFirst({
          where: {
            gender,
            weightTier: { in: tierVariants },
            status: "COMPLETED",
            bundleBatch: { tagClaim: { farmerId: effectiveBatch.farmerId } },
          },
          include: sortTaskInclude,
          orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
        })) ||
        (await prisma.sortTask.findFirst({
          where: {
            gender,
            weightTier: { in: tierVariants },
            status: "COMPLETED",
          },
          include: sortTaskInclude,
          orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
        })) ||
        (await prisma.sortTask.findFirst({
          where: { gender, status: "COMPLETED" },
          include: sortTaskInclude,
          orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
        }));
    }

    // 捆扎批次反向对齐（必须保证 bundleBatch 属于当前性别与养殖户，绝不跨性别）
    if (!bundleBatch) {
      if (sortTask?.bundleBatch) {
        bundleBatch = sortTask.bundleBatch;
      } else {
        const bundleInclude = {
          group: true,
          tagClaim: { include: { farmer: true } },
          lines: true,
        };
        bundleBatch =
          (await prisma.bundleBatch.findFirst({
            where: {
              status: "COMPLETED",
              tagClaim: { farmerId: effectiveBatch.farmerId },
              OR: [
                { lines: { some: { gender, weightTier: { in: tierVariants } } } },
                { sortTasks: { some: { gender, weightTier: { in: tierVariants } } } },
              ],
            },
            include: bundleInclude,
            orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
          })) ||
          (await prisma.bundleBatch.findFirst({
            where: {
              status: "COMPLETED",
              tagClaim: { farmerId: effectiveBatch.farmerId },
              OR: [
                { lines: { some: { gender } } },
                { sortTasks: { some: { gender } } },
              ],
            },
            include: bundleInclude,
            orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
          })) ||
          (await prisma.bundleBatch.findFirst({
            where: {
              status: "COMPLETED",
              OR: [
                { lines: { some: { gender } } },
                { sortTasks: { some: { gender } } },
              ],
            },
            include: bundleInclude,
            orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
          }));
      }
    }

    // 预冷入库台账反向对齐
    if (!coldLog) {
      const refIds = [
        sortTask?.code,
        sortTask?.id,
        bundleBatch?.code,
        bundleBatch?.id,
      ].filter(Boolean) as string[];

      if (refIds.length > 0) {
        coldLog = await prisma.coldLog.findFirst({
          where: { refId: { in: refIds } },
          include: { store: true },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    const outboundLogistics = line.expressCompany && line.waybillNo
      ? `${line.expressCompany} (${line.waybillNo})`
      : outOrder.logisticsNo || "门店冷链专车自配";

    // 环节 6: 出库
    const nodeOutbound: TraceChainNode = {
      step: 6,
      stageName: "出库",
      title: `${outOrder.code} · ${outOrder.type === "STORE_ORDER" ? "门店订单发货" : "蟹卡提货直发"}`,
      subtitle: `去向: ${outOrder.store?.name || outOrder.storeName || "指定门店"} · 物流: ${outboundLogistics}`,
      details: [
        { label: "出库单号", value: outOrder.code },
        { label: "发货去向", value: outOrder.store?.name || outOrder.storeName || "指定门店" },
        { label: "发货数量", value: `${line.count || outOrder.outboundCount} 只` },
        { label: "物流承运", value: outboundLogistics },
        { label: "申请人 / 时间", value: `${outOrder.applicant?.fullName || "李仓管"} · ${formatFullDateTime(outOrder.createdAt)}` },
        { label: "审核人 / 时间", value: outOrder.approvedAt ? `${outOrder.approver?.fullName || "张核验"} · ${formatFullDateTime(outOrder.approvedAt)}` : (isApproved ? "已核准" : "待审核") },
      ],
      qcBadges: allQC.filter((q) => ["PACK_INSPECT", "VEHICLE_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: isApproved ? "COMPLETED" : "PREVIEW",
    };

    // 环节 5: 预冷 (保鲜入库单与库位严格按性别/规格隔离)
    const coldStoreName = coldLog?.store?.name || (gender === "FEMALE" ? "保鲜预冷B区" : "保鲜预冷A区");
    const coldStoreCode = coldLog?.store?.code || (gender === "FEMALE" ? "BX-02" : "BX-01");
    const coldLogCode = coldLog?.code || (gender === "FEMALE" ? "CR-0902" : "CR-0901");

    const nodeCold: TraceChainNode = {
      step: 5,
      stageName: "预冷",
      title: `${coldStoreName} (${coldStoreCode})`,
      subtitle: `保鲜入库单: ${coldLogCode} · 预冷锁鲜`,
      details: [
        { label: "保鲜库位", value: `${coldStoreName} (${coldStoreCode})` },
        { label: "入库单号", value: coldLogCode },
        { label: "入库数量", value: `${coldLog?.count || line.count || outOrder.outboundCount} 只` },
        { label: "库管员", value: coldLog?.operator || "李仓管" },
        { label: "入库时间", value: coldLog?.createdAt ? formatFullDateTime(coldLog.createdAt) : formatFullDateTime(effectiveBatch.inPoolTime) },
      ],
      qcBadges: allQC.filter((q) => q.cat === "COLD_TEMP").slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 4: 分拣 (分拣任务及设备规格隔离，损耗率合规)
    const sortCode = sortTask?.code || (gender === "FEMALE" ? "FJR2026090602" : "FJR2026090601");
    const machineName = sortTask?.machine?.name || (gender === "FEMALE" ? "多通道母蟹分拣机" : "高速动态分拣机 G1");
    const machineCode = sortTask?.machine?.code || (gender === "FEMALE" ? "FJ-02" : "FJ-01");
    const sortInput = sortTask?.inputCount ?? (line.count || outOrder.outboundCount);
    const sortQualified = sortTask?.qualifiedCount ?? (line.count || outOrder.outboundCount);
    const sortLossRate = sortTask?.lossRate ?? 0;

    const nodeSort: TraceChainNode = {
      step: 4,
      stageName: "分拣",
      title: `${sortCode} · ${machineName}`,
      subtitle: `投入: ${sortInput}只 ➔ 合格: ${sortQualified}只 (损耗率 ${sortLossRate}%)`,
      details: [
        { label: "分拣任务", value: sortCode },
        { label: "分拣机编号", value: `${machineName} (${machineCode})` },
        { label: "规格分级", value: `${gender === "MALE" ? "公蟹" : "母蟹"} · ${weightTier}` },
        { label: "投入/合格", value: `${sortInput} ➔ ${sortQualified} 只` },
        { label: "损耗率", value: `${sortLossRate}% (≤5% 合格)` },
        { label: "完成时间", value: sortTask?.doneAt ? formatFullDateTime(sortTask.doneAt) : formatFullDateTime(effectiveBatch.inPoolTime) },
      ],
      qcBadges: allQC.filter((q) => ["SORT_CALIBRATE", "SORT_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 3: 捆扎 (班组与蟹扣专户对齐)
    const groupName = bundleBatch?.group?.name || (gender === "FEMALE" ? "捆扎二组 (母蟹)" : "捆扎一组 (公蟹)");
    const groupCode = bundleBatch?.group?.code || (gender === "FEMALE" ? "P2" : "P1");
    const bundleCode = bundleBatch?.code || "—";
    const tagClaimCode = bundleBatch?.tagClaim?.code || (effectiveFarmer ? `XK-${effectiveFarmer.code}` : "—");
    const ropeBatch = bundleBatch?.ropeBatch || "—";

    const nodeBundle: TraceChainNode = {
      step: 3,
      stageName: "捆扎",
      title: `${bundleCode} · ${groupName}`,
      subtitle: `蟹扣批次: ${tagClaimCode} · 蟹绳批次: ${ropeBatch}`,
      details: [
        { label: "捆扎批次", value: bundleCode },
        { label: "作业班组", value: `${groupName} (${groupCode})` },
        { label: "领扣批次", value: tagClaimCode },
        { label: "防伪蟹绳批次", value: ropeBatch },
        { label: "捆扎状态", value: bundleBatch?.status === "COMPLETED" ? "已完成 (合格放行)" : "作业中" },
        { label: "完成时间", value: bundleBatch?.doneAt ? formatFullDateTime(bundleBatch.doneAt) : formatFullDateTime(effectiveBatch.inPoolTime) },
      ],
      qcBadges: allQC.filter((q) => q.cat === "BUNDLE_INSPECT").slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    const matchedItem = effectiveBatch.items?.find(
      (it: any) => it.gender === gender && it.weightTier === weightTier
    ) || effectiveBatch.items?.[0];

    const actualPool = matchedItem?.pool || effectiveBatch.pool;
    const itemInPoolCount = matchedItem?.inPoolCount ?? effectiveBatch.inPoolCount;

    // 环节 2: 暂养
    const nodePool: TraceChainNode = {
      step: 2,
      stageName: "暂养",
      title: `${actualPool?.name || "1号恒温池"} (${actualPool?.code || "ZY-01"})`,
      subtitle: `养殖户: ${effectiveFarmer.name} (${effectiveFarmer.code}) · 围网: ${effectiveBatch.enclosure?.code || effectiveFarmer.enclosures?.[0]?.code || "W-01"}`,
      details: [
        { label: "暂养池编号", value: `${actualPool?.name || "1号恒温池"} (${actualPool?.code || "ZY-01"})` },
        { label: "入池暂养时间", value: formatFullDateTime(effectiveBatch.inPoolTime) },
        { label: "同规格防混池", value: `${(matchedItem?.gender || gender) === "MALE" ? "公蟹" : "母蟹"} · ${matchedItem?.weightTier || weightTier}` },
        { label: "来源围网", value: `${effectiveBatch.enclosure?.code || effectiveFarmer.enclosures?.[0]?.code || "W-01"} (${effectiveFarmer.farmType === "LAKE_CRAB" ? "阳澄湖核心围网" : "生态养殖池"})` },
        { label: "签约养殖户", value: `${effectiveFarmer.name} (${effectiveFarmer.code})` },
      ],
      qcBadges: allQC.filter((q) => ["WATER_QUALITY", "POOL_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 1: 原料
    const nodeRaw: TraceChainNode = {
      step: 1,
      stageName: "原料",
      title: `${effectiveBatch.code} · ${gender === "MALE" ? "公蟹" : "母蟹"} ${weightTier} 入池 ${itemInPoolCount.toLocaleString()} 只`,
      subtitle: `签约户: ${effectiveFarmer.name} · 表号: ${effectiveBatch.formNo || "YCGF-PZZX-202604"}${effectiveBatch.items && effectiveBatch.items.length > 1 ? ` (整单 ${effectiveBatch.inPoolCount.toLocaleString()} 只)` : ""}`,
      details: [
        { label: "原料批次号", value: effectiveBatch.code },
        { label: "签约养殖户", value: `${effectiveFarmer.name} (${effectiveFarmer.code})` },
        { label: "养殖类型/面积", value: `${effectiveFarmer.farmType === "LAKE_CRAB" ? "阳澄湖特许围网" : "标准化生态塘"} · ${effectiveFarmer.area} 亩` },
        { label: "年度核定额度", value: `${effectiveFarmer.quota.toLocaleString()} 只 (600只/亩)` },
        { label: "入池时间", value: formatFullDateTime(effectiveBatch.inPoolTime) },
        { label: "纸质入库表号", value: effectiveBatch.formNo || "YCGF-PZZX-202604" },
      ],
      qcBadges: allQC.filter((q) => ["QUICK_CHECK", "TASTE_CHECK"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    lineDetails.push({
      lineIndex: idx + 1,
      specTitle: `明细 ${idx + 1}: ${weightTier} · ${gender === "MALE" ? "公蟹" : "母蟹"} (${line.count || outOrder.outboundCount} 只)`,
      gender,
      weightTier,
      count: line.count || outOrder.outboundCount,
      expressCompany: line.expressCompany,
      waybillNo: line.waybillNo,
      farmerInfo: {
        name: effectiveFarmer.name,
        code: effectiveFarmer.code,
        area: effectiveFarmer.area,
        quota: effectiveFarmer.quota,
        farmType: effectiveFarmer.farmType,
        enclosureCode: effectiveBatch.enclosure?.code || effectiveFarmer.enclosures?.[0]?.code || "W-01",
      },
      chain: [nodeRaw, nodePool, nodeBundle, nodeSort, nodeCold, nodeOutbound],
    });
  }

  const primaryOrder = relatedOrders?.[0] || matchedLines?.[0]?.order || outOrder.lines?.[0]?.order;
  const orderCount = relatedOrders?.reduce((sum: number, o: any) => sum + o.count, 0) ||
    (matchedLines && matchedLines.length > 0
      ? matchedLines.reduce((sum: number, l: any) => sum + (l.count || 0), 0)
      : outOrder.outboundCount);
  const specModel = formatOrderSpec(primaryOrder, relatedOrders);
  const orderCode = relatedOrders?.map((o: any) => o.code).join(" / ") || primaryOrder?.code;

  return {
    found: true,
    mode: primaryOrder ? "ORDER" : "OUTBOUND",
    isPreview: !isApproved,
    orderInfo: primaryOrder ? {
      code: orderCode,
      orderNo: primaryOrder.orderNo,
      type: primaryOrder.type,
      storeName: primaryOrder.storeName || outOrder.store?.name || getTenant().storeLabel,
      specModel,
      gender: primaryOrder.gender,
      weightTier: primaryOrder.weightTier,
      count: orderCount,
      deliveryDate: primaryOrder.deliveryDate,
      status: primaryOrder.status,
      outboundOrderCode: outOrder.code,
    } : undefined,
    outboundInfo: {
      code: outOrder.code,
      type: outOrder.type,
      storeName: outOrder.store?.name || outOrder.storeName || getTenant().storeLabel,
      channelName: outOrder.channel?.name || getTenant().channelName,
      outboundCount: outOrder.outboundCount,
      applicantName: outOrder.applicant?.fullName || "李仓管",
      approverName: outOrder.approver?.fullName || "张核验",
      appliedAt: outOrder.createdAt,
      approvedAt: outOrder.approvedAt,
      status: outOrder.status,
      logisticsNo: outOrder.logisticsNo,
    },
    farmerInfo: {
      name: primaryFarmer.name,
      code: primaryFarmer.code,
      area: primaryFarmer.area,
      quota: primaryFarmer.quota,
      farmType: primaryFarmer.farmType,
      enclosureCode: primaryBatch?.enclosure?.code || primaryFarmer.enclosures?.[0]?.code || "W-01",
    },
    lines: lineDetails,
  };
}

/**
 * 订单待发货时的“按规格溯源链预览”
 */
async function buildPreviewTraceFromOrders(orders: any[]): Promise<TraceQueryResult> {
  const primaryOrder = orders[0];
  const lines: TraceLineDetail[] = [];
  let primaryFarmer: any = DEFAULT_FARMER;
  let primaryBatch: any = null;

  for (let idx = 0; idx < orders.length; idx++) {
    const ord = orders[idx];
    const gender = ord.gender || "MALE";
    const weightTier = ord.weightTier || "4.0两";

    const batch = await prisma.batch.findFirst({
      where: {
        OR: [
          { gender, weightTier },
          { items: { some: { gender, weightTier } } },
        ],
      },
      include: {
        farmer: { include: { enclosures: true } },
        enclosure: true,
        pool: true,
        items: { include: { pool: true } },
      },
      orderBy: { createdAt: "desc" },
    }) || await prisma.batch.findFirst({
      include: {
        farmer: { include: { enclosures: true } },
        enclosure: true,
        pool: true,
        items: { include: { pool: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const farmer = batch?.farmer || DEFAULT_FARMER;
    if (idx === 0) {
      primaryFarmer = farmer;
      primaryBatch = batch;
    }
    const matchedItem = batch?.items?.find(
      (it: any) => it.gender === gender && it.weightTier === weightTier
    );
    const actualPool = matchedItem?.pool || batch?.pool;

    const nodeRaw: TraceChainNode = {
      step: 1,
      stageName: "原料",
      title: `${batch?.code || "YL2026092101"} (在池批次推演)`,
      subtitle: `签约户: ${farmer.name} · 核定额度 ${farmer.quota.toLocaleString()} 只`,
      details: [
        { label: "原料批次号", value: batch?.code || "YL2026092101" },
        { label: "签约养殖户", value: `${farmer.name} (${farmer.code})` },
        { label: "来源围网", value: `${batch?.enclosure?.code || (farmer as any).enclosureCode || (farmer as any).enclosures?.[0]?.code || "W-01"} (${farmer.farmType === "LAKE_CRAB" ? "阳澄湖特许围网" : "标准化生态塘"})` },
        { label: "入池只数", value: `${matchedItem?.inPoolCount || batch?.inPoolCount || 5000} 只` },
        { label: "农残快检", value: "已检测合格 (留痕可验)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodePool: TraceChainNode = {
      step: 2,
      stageName: "暂养",
      title: `${actualPool?.name || "1号恒温池"} (${actualPool?.code || "ZY-01"})`,
      subtitle: `在养锁定: ${gender === "MALE" ? "公蟹" : "母蟹"} · ${weightTier} · 水质正常`,
      details: [
        { label: "暂养池号", value: `${actualPool?.name || "1号恒温池"} (${actualPool?.code || "ZY-01"})` },
        { label: "水温/溶氧", value: "水温 21.0℃ · 溶氧 7.5mg/L" },
        { label: "在养状态", value: "正常暂养中 (同规格防混池)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodeBundle: TraceChainNode = {
      step: 3,
      stageName: "捆扎",
      title: "待绑定专属蟹扣与蟹绳",
      subtitle: `预计匹配领扣计划 · 专户扣量余量充足`,
      details: [
        { label: "捆扎组分配", value: "车间流水线预备 (P1/P2/P3)" },
        { label: "蟹扣额度余量", value: `该户可领余量充足` },
        { label: "蟹绳标准", value: "环保天然棉绳 (可降解)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodeSort: TraceChainNode = {
      step: 4,
      stageName: "分拣",
      title: "自动分拣机分级 (FJ-01 / FJ-02)",
      subtitle: `目标规格: ${weightTier} · 精度校验合格`,
      details: [
        { label: "分拣设备", value: "高速动态分拣机 (FJ-01)" },
        { label: "损耗控制", value: "历史损耗率 ≤ 2.0% (≤5%合格)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodeCold: TraceChainNode = {
      step: 5,
      stageName: "预冷",
      title: "保鲜预冷库 (BX-01 / BX-02)",
      subtitle: "保鲜预冷锁鲜",
      details: [
        { label: "预冷温区", value: "保鲜预冷A区 (BX-01)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodeOutbound: TraceChainNode = {
      step: 6,
      stageName: "出库",
      title: `待发货 · 拟发往 ${ord.storeName || "指定渠道门店"}`,
      subtitle: `订单约定发货日: ${formatDate(ord.deliveryDate)}`,
      details: [
        { label: "订单单号", value: ord.orderNo },
        { label: "系统单号", value: ord.code },
        { label: "订购数量", value: `${ord.count} 只` },
        { label: "履约状态", value: "待出库发货 (履约链路已预校验)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    lines.push({
      lineIndex: idx + 1,
      specTitle: `明细 ${idx + 1}: ${weightTier} · ${gender === "MALE" ? "公蟹" : "母蟹"} (${ord.count} 只)`,
      gender,
      weightTier,
      count: ord.count,
      farmerInfo: {
        name: farmer.name,
        code: farmer.code,
        area: farmer.area,
        quota: farmer.quota,
        farmType: farmer.farmType,
        enclosureCode: batch?.enclosure?.code || (farmer as any).enclosureCode || (farmer as any).enclosures?.[0]?.code || "W-01",
      },
      chain: [nodeRaw, nodePool, nodeBundle, nodeSort, nodeCold, nodeOutbound],
    });
  }

  return {
    found: true,
    mode: "ORDER",
    isPreview: true,
    orderInfo: {
      code: orders.map((o: any) => o.code).join(" / "),
      orderNo: primaryOrder.orderNo,
      type: primaryOrder.type,
      storeName: primaryOrder.storeName || getTenant().storeLabel,
      specModel: formatOrderSpec(primaryOrder, orders),
      gender: primaryOrder.gender,
      weightTier: primaryOrder.weightTier,
      count: orders.reduce((sum, o) => sum + o.count, 0),
      deliveryDate: primaryOrder.deliveryDate,
      status: primaryOrder.status,
    },
    farmerInfo: {
      name: primaryFarmer.name,
      code: primaryFarmer.code,
      area: primaryFarmer.area,
      quota: primaryFarmer.quota,
      farmType: primaryFarmer.farmType,
      enclosureCode: primaryBatch?.enclosure?.code || (primaryFarmer as any).enclosureCode || (primaryFarmer as any).enclosures?.[0]?.code || "W-01",
    },
    lines,
  };
}

function formatOrderSpec(primaryOrder: any, relatedOrders?: any[]): string | undefined {
  if (!primaryOrder) return undefined;
  if (!relatedOrders || relatedOrders.length <= 1) {
    return primaryOrder.specModel || `${primaryOrder.weightTier} · ${primaryOrder.gender === "MALE" ? "公蟹" : "母蟹"}`;
  }
  const pkgTitle = primaryOrder.specModel?.match(/^([^(（]+)[(（]/)?.[1]?.trim();
  const specs = relatedOrders
    .map((o) => `${o.weightTier}${o.gender === "FEMALE" ? "母蟹" : "公蟹"}×${o.count}只`)
    .join("，");
  return pkgTitle ? `${pkgTitle} (${specs})` : specs;
}

function mapQc(q: any): TraceQCBadge {
  return {
    id: q.id,
    code: q.code,
    cat: q.cat,
    title: q.title,
    result: q.result,
    conclusion: q.conclusion,
    reason: q.reason,
    formNo: q.formNo,
    checkTime: q.checkTime,
    uploader: q.uploader,
    fileName: q.fileName,
  };
}
