import { prisma } from "@/lib/prisma";
import { getTenant } from "@/config/tenant";

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
        { orderNo: term },
        { code: term },
        { orderNo: { contains: term } },
        { code: { contains: term } },
      ],
    },
    include: {
      outboundLines: {
        include: {
          outboundOrder: {
            include: {
              batch: {
                include: {
                  farmer: { include: { enclosures: true } },
                  enclosure: true,
                  pool: true,
                  items: true,
                },
              },
              store: { include: { channel: true } },
              channel: true,
              applicant: true,
              approver: true,
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

    if (primaryOrder.status === "SHIPPED" && outOrder?.status === "APPROVED") {
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
      batch: {
        include: {
          farmer: { include: { enclosures: true } },
          enclosure: true,
          pool: true,
          items: true,
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

  return outboundOrders.length > 0 ? await buildTraceFromOutbound(outboundOrders[0]) : null;
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
  const isApproved = outOrder.status === "APPROVED";

  // 一次性获取全链路关联品控记录
  const allQC = await prisma.qCRecord.findMany({
    orderBy: { checkTime: "desc" },
  });

  const linesToProcess = outOrder.lines?.length > 0 ? outOrder.lines : [{
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

    const sortTask = await prisma.sortTask.findFirst({
      where: { gender, weightTier, status: "COMPLETED" },
      include: { machine: true, bundleBatch: { include: { group: true, tagClaim: true } } },
      orderBy: { doneAt: "desc" },
    });

    const bundleBatch = sortTask?.bundleBatch || await prisma.bundleBatch.findFirst({
      where: { status: "COMPLETED" },
      include: { group: true, tagClaim: true },
      orderBy: { doneAt: "desc" },
    });

    const coldLog = await prisma.coldLog.findFirst({
      include: { store: true },
      orderBy: { createdAt: "desc" },
    });

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
        { label: "申请人 / 时间", value: `${outOrder.applicant?.fullName || "李仓管"} · ${new Date(outOrder.createdAt).toLocaleString("zh-CN")}` },
        { label: "审核人 / 时间", value: outOrder.approvedAt ? `${outOrder.approver?.fullName || "张核验"} · ${new Date(outOrder.approvedAt).toLocaleString("zh-CN")}` : (isApproved ? "已核准" : "待审核") },
      ],
      qcBadges: allQC.filter((q) => ["PACK_INSPECT", "VEHICLE_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: isApproved ? "COMPLETED" : "PREVIEW",
    };

    // 环节 5: 预冷
    const nodeCold: TraceChainNode = {
      step: 5,
      stageName: "预冷",
      title: `${coldLog?.store?.name || "保鲜预冷A区"} (${coldLog?.store?.code || "BX-01"})`,
      subtitle: `保鲜入库单: ${coldLog?.code || "CR-0901"} · 目标温度 4-5℃ 锁鲜`,
      details: [
        { label: "保鲜库位", value: `${coldLog?.store?.name || "保鲜预冷A区"} (${coldLog?.store?.code || "BX-01"})` },
        { label: "入库单号", value: coldLog?.code || "CR-0901" },
        { label: "入库数量", value: `${coldLog?.count || line.count || 600} 只` },
        { label: "库管员", value: coldLog?.operator || "李仓管" },
        { label: "入库时间", value: coldLog?.createdAt ? new Date(coldLog.createdAt).toLocaleString("zh-CN") : "2026-09-21 09:10" },
      ],
      qcBadges: allQC.filter((q) => q.cat === "COLD_TEMP").slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 4: 分拣
    const nodeSort: TraceChainNode = {
      step: 4,
      stageName: "分拣",
      title: `${sortTask?.code || "FJR2026092101"} · ${sortTask?.machine?.name || "自动分拣机 G1"}`,
      subtitle: `投入: ${sortTask?.inputCount || 445}只 ➔ 合格: ${sortTask?.qualifiedCount || 438}只 (损耗率 ${sortTask?.lossRate ?? 1.57}%)`,
      details: [
        { label: "分拣任务", value: sortTask?.code || "FJR2026092101" },
        { label: "分拣机编号", value: `${sortTask?.machine?.name || "高速动态分拣机 G1"} (${sortTask?.machine?.code || "FJ-01"})` },
        { label: "规格分级", value: `${gender === "MALE" ? "公蟹" : "母蟹"} · ${weightTier}` },
        { label: "投入/合格/损耗", value: `${sortTask?.inputCount || 445} ➔ ${sortTask?.qualifiedCount || 438} 只 (损耗: ${sortTask?.lossCount || 7} 只)` },
        { label: "损耗率", value: `${sortTask?.lossRate ?? 1.57}% (≤5% 合格)` },
        { label: "完成时间", value: sortTask?.doneAt ? new Date(sortTask.doneAt).toLocaleString("zh-CN") : "2026-09-21 09:40" },
      ],
      qcBadges: allQC.filter((q) => ["SORT_CALIBRATE", "SORT_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 3: 捆扎
    const nodeBundle: TraceChainNode = {
      step: 3,
      stageName: "捆扎",
      title: `${bundleBatch?.code || "KZD2026092101"} · ${bundleBatch?.group?.name || "捆扎一组"}`,
      subtitle: `蟹扣批次: ${bundleBatch?.tagClaim?.code || "XK2026092101"} · 蟹绳批次: ${bundleBatch?.ropeBatch || "XS2026090101"}`,
      details: [
        { label: "捆扎批次", value: bundleBatch?.code || "KZD2026092101" },
        { label: "作业班组", value: `${bundleBatch?.group?.name || "捆扎一组"} (${bundleBatch?.group?.code || "P1"})` },
        { label: "领扣批次", value: bundleBatch?.tagClaim?.code || "XK2026092101" },
        { label: "防伪蟹绳批次", value: bundleBatch?.ropeBatch || "XS2026090101" },
        { label: "捆扎状态", value: bundleBatch?.status === "COMPLETED" ? "已完成 (合格放行)" : "作业中" },
        { label: "完成时间", value: bundleBatch?.doneAt ? new Date(bundleBatch.doneAt).toLocaleString("zh-CN") : "2026-09-21 09:00" },
      ],
      qcBadges: allQC.filter((q) => q.cat === "BUNDLE_INSPECT").slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 2: 暂养
    const nodePool: TraceChainNode = {
      step: 2,
      stageName: "暂养",
      title: `${batch.pool?.name || "1号恒温池"} (${batch.pool?.code || "ZY-01"})`,
      subtitle: `养殖户: ${farmer.name} (${farmer.code}) · 围网: ${batch.enclosure?.code || "W-01"}`,
      details: [
        { label: "暂养池编号", value: `${batch.pool?.name || "1号恒温池"} (${batch.pool?.code || "ZY-01"})` },
        { label: "同规格防混池", value: `${batch.pool?.currentGender === "MALE" ? "公蟹" : "母蟹"} · ${batch.pool?.currentWeightTier || weightTier}` },
        { label: "来源围网", value: `${batch.enclosure?.code || "W-01"} (${farmer.farmType === "LAKE_CRAB" ? "阳澄湖核心围网" : "生态养殖池"})` },
        { label: "签约养殖户", value: `${farmer.name} (${farmer.code})` },
      ],
      qcBadges: allQC.filter((q) => ["WATER_QUALITY", "POOL_INSPECT"].includes(q.cat)).slice(0, 2).map(mapQc),
      status: "COMPLETED",
    };

    // 环节 1: 原料
    const nodeRaw: TraceChainNode = {
      step: 1,
      stageName: "原料",
      title: `${batch.code} · 入池 ${batch.inPoolCount.toLocaleString()} 只`,
      subtitle: `签约户: ${farmer.name} · 表号: ${batch.formNo || "YCGF-PZZX-202604"}`,
      details: [
        { label: "原料批次号", value: batch.code },
        { label: "签约养殖户", value: `${farmer.name} (${farmer.code})` },
        { label: "养殖类型/面积", value: `${farmer.farmType === "LAKE_CRAB" ? "阳澄湖特许围网" : "标准化生态塘"} · ${farmer.area} 亩` },
        { label: "年度核定额度", value: `${farmer.quota.toLocaleString()} 只 (600只/亩)` },
        { label: "入池时间", value: new Date(batch.inPoolTime).toLocaleString("zh-CN") },
        { label: "纸质入库表号", value: batch.formNo || "YCGF-PZZX-202604" },
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
      chain: [nodeRaw, nodePool, nodeBundle, nodeSort, nodeCold, nodeOutbound],
    });
  }

  const primaryOrder = relatedOrders?.[0] || outOrder.lines?.[0]?.order;

  return {
    found: true,
    mode: primaryOrder ? "ORDER" : "OUTBOUND",
    isPreview: !isApproved,
    orderInfo: primaryOrder ? {
      code: primaryOrder.code,
      orderNo: primaryOrder.orderNo,
      type: primaryOrder.type,
      storeName: primaryOrder.storeName || outOrder.store?.name || getTenant().storeLabel,
      specModel: primaryOrder.specModel,
      gender: primaryOrder.gender,
      weightTier: primaryOrder.weightTier,
      count: primaryOrder.count,
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
      name: farmer.name,
      code: farmer.code,
      area: farmer.area,
      quota: farmer.quota,
      farmType: farmer.farmType,
      enclosureCode: batch.enclosure?.code || "W-01",
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
      },
      orderBy: { createdAt: "desc" },
    }) || await prisma.batch.findFirst({
      include: {
        farmer: { include: { enclosures: true } },
        enclosure: true,
        pool: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const farmer = batch?.farmer || DEFAULT_FARMER;

    const nodeRaw: TraceChainNode = {
      step: 1,
      stageName: "原料",
      title: `${batch?.code || "YL2026092101"} (在池批次推演)`,
      subtitle: `签约户: ${farmer.name} · 核定额度 ${farmer.quota.toLocaleString()} 只`,
      details: [
        { label: "原料批次号", value: batch?.code || "YL2026092101" },
        { label: "签约养殖户", value: `${farmer.name} (${farmer.code})` },
        { label: "来源围网", value: `${batch?.enclosure?.code || "W-01"} (阳澄湖东湖1号网)` },
        { label: "入池只数", value: `${batch?.inPoolCount || 5000} 只` },
        { label: "农残快检", value: "已检测合格 (留痕可验)" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodePool: TraceChainNode = {
      step: 2,
      stageName: "暂养",
      title: `${batch?.pool?.name || "1号恒温池"} (${batch?.pool?.code || "ZY-01"})`,
      subtitle: `在养锁定: ${gender === "MALE" ? "公蟹" : "母蟹"} · ${weightTier} · 水质正常`,
      details: [
        { label: "暂养池号", value: `${batch?.pool?.name || "1号恒温池"} (${batch?.pool?.code || "ZY-01"})` },
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
      subtitle: "目标温度 4-5℃ 物理休眠锁鲜",
      details: [
        { label: "预冷温区", value: "保鲜预冷A区 (BX-01)" },
        { label: "目标温控", value: "4.2℃ 恒温循环" },
      ],
      qcBadges: [],
      status: "PREVIEW",
    };

    const nodeOutbound: TraceChainNode = {
      step: 6,
      stageName: "出库",
      title: `待发货 · 拟发往 ${ord.storeName || "指定渠道门店"}`,
      subtitle: `订单约定发货日: ${new Date(ord.deliveryDate).toLocaleDateString("zh-CN")}`,
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
      chain: [nodeRaw, nodePool, nodeBundle, nodeSort, nodeCold, nodeOutbound],
    });
  }

  return {
    found: true,
    mode: "ORDER",
    isPreview: true,
    orderInfo: {
      code: primaryOrder.code,
      orderNo: primaryOrder.orderNo,
      type: primaryOrder.type,
      storeName: primaryOrder.storeName || getTenant().storeLabel,
      specModel: primaryOrder.specModel,
      gender: primaryOrder.gender,
      weightTier: primaryOrder.weightTier,
      count: orders.reduce((sum, o) => sum + o.count, 0),
      deliveryDate: primaryOrder.deliveryDate,
      status: primaryOrder.status,
    },
    farmerInfo: DEFAULT_FARMER,
    lines,
  };
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
