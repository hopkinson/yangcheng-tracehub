/**
 * 阳澄股份大闸蟹溯源系统 - 五大数量守恒与卡控纯函数引擎 (PRD V2.1)
 */

export interface FarmerQuotaCheck {
  annualQuota: number;
  cumulativeInPool: number;
  newBatchCount: number;
}

export interface TagClaimCheck {
  farmerQuota: number;
  cumulativeBoundCount: number;
  requestedCount: number;
}

export interface LossCalculation {
  bookInPool: number;
  physicalCount: number;
  inPoolCount: number;
  historicalLoss: number;
}

export interface OutboundCheck {
  bookInPool: number;
  outboundCount: number;
  channelOrderCount: number;
}

export interface DailyTagBalanceCheck {
  claimedCount: number;
  boundCount: number;
  returnedCount: number;
  scrappedCount: number;
}

export interface ColdStorageInventoryCheck {
  availableCount: number;
  requestedCount: number;
  spec?: string;
  gender?: string;
}

export interface ColdIntakeCheck {
  qualifiedCount: number;
  alreadyIntakeCount: number;
  intakeCount: number;
  taskStatus?: string;
  taskCode?: string;
}

export interface SortTaskIntakeCheck {
  bundleLineCount: number;
  alreadySortedCount: number;
  inputCount: number;
  bundleStatus?: string;
  bundleCode?: string;
  spec?: string;
}

export interface ProcessLossCheck {
  inputCount: number;
  qualifiedCount: number;
}
export type SortingLossCheck = ProcessLossCheck;
export type BundleLossCheck = ProcessLossCheck;

export interface ParsedSpecItem {
  gender: "FEMALE" | "MALE";
  weightTier: string;
  count: number;
}

export interface SpecStockInfo {
  gender: string;
  weightTier: string;
  label: string;
  qualified: number;
  used: number;
  loss: number;
  available: number;
  usagePct: number;
}

export interface RawImportOrder {
  orderNo: string;
  type: "STORE_ORDER" | "CRAB_CARD";
  storeName?: string;
  storeCode?: string;
  specModel?: string;
  gender: string;
  weightTier: string;
  count: number;
  deliveryDate: string; // YYYY-MM-DD
  isPreSplit?: boolean;
}

function parseStoreSpecHeader(cell: string) {
  const match = cell.replace(/\s|两|蟹/g, "").match(/^([1-9])(?:\.?([0-9]))?(公|母)$/);
  if (!match) return null;

  const weight = `${match[1]}.${match[2] || "0"}`;
  return {
    weightTier: `${Number(weight).toFixed(1)}两`,
    gender: (match[3] === "母" ? "FEMALE" : "MALE") as "FEMALE" | "MALE",
    specTag: `${Number(weight).toFixed(1)}${match[3]}`,
  };
}

export const Invariants = {
  // 1. 额度校验: 面积 * 600 只/亩
  calculateQuota: (areaInMu: number): number => Math.floor(areaInMu * 600),

  // 校验入池是否超额
  checkQuota: ({ annualQuota, cumulativeInPool, newBatchCount }: FarmerQuotaCheck) => {
    const isExceeded = cumulativeInPool + newBatchCount > annualQuota;
    return {
      valid: !isExceeded,
      remainingQuota: Math.max(0, annualQuota - cumulativeInPool),
      excess: isExceeded ? cumulativeInPool + newBatchCount - annualQuota : 0,
    };
  },

  // 暂养池实时活蟹存量计算（优先多规格明细，回退单批次）
  calculatePoolLiveCount: (pool: { batches?: any[]; batchItems?: any[] }): number => {
    const list = pool.batchItems && pool.batchItems.length > 0 ? pool.batchItems : pool.batches || [];
    return list.reduce((sum: number, x: any) => sum + Math.max(0, x.inPoolCount - (x.outPoolCount || 0) - (x.lossCount || 0)), 0);
  },

  checkBatchEditCoverage: (newInPoolCount: number, outPoolCount: number, lossCount: number) => {
    const minimumCount = outPoolCount + lossCount;
    return {
      valid: Number.isInteger(newInPoolCount) && newInPoolCount >= minimumCount,
      minimumCount,
      reason: `入池数量不能小于已绑扎/起池 ${outPoolCount} 只与已登记损耗 ${lossCount} 只之和（${minimumCount} 只）`,
    };
  },

  // 2. 暂养池空池入池校验: 严禁混入已有在养存量，必须为空池方可入池并锁定规格
  checkPoolSpec: (
    pool: { currentGender: string | null; currentWeightTier: string | null; activeCount?: number },
    target: { gender: string; weightTier: string }
  ) => {
    if (!pool.currentGender || !pool.activeCount || pool.activeCount === 0) {
      return { valid: true, requiresBinding: true, reason: "空池，允许入池并锁定规格" };
    }
    const poolGenderLabel = pool.currentGender === "FEMALE" || pool.currentGender === "母" ? "母蟹" : "公蟹";
    return {
      valid: false,
      requiresBinding: false,
      reason: `暂养池批次隔离拦截：该池已有在养存量（在养【${poolGenderLabel} / ${pool.currentWeightTier}】共 ${pool.activeCount} 只），为确保批次溯源独立性，禁止混入新批次，只能选择空池！`,
    };
  },

  // 3. 蟹扣领用只受年度额度约束；实际消耗仅在完成捆扎时计入 boundCount
  checkTagClaim: ({ farmerQuota, cumulativeBoundCount, requestedCount }: TagClaimCheck) => {
    const remainingQuota = Math.max(0, farmerQuota - cumulativeBoundCount);
    const valid = requestedCount > 0 && requestedCount <= remainingQuota;
    return {
      valid,
      maxClaimable: remainingQuota,
      remainingQuota,
      reason: valid ? "领用数量在年度额度范围内" : `超领拦截: 申请 ${requestedCount} 只，当前年度额度余量为 ${remainingQuota} 只`,
    };
  },

  // 4. 盘点损耗计算与 5% 阈值告警
  calculateLoss: ({ bookInPool, physicalCount, inPoolCount, historicalLoss }: LossCalculation) => {
    if (physicalCount > bookInPool) {
      return {
        valid: false,
        lossDelta: 0,
        totalLoss: 0,
        lossRate: 0,
        isException: true,
        reason: "实盘数量大于账面在池，请核查盘点数量",
      };
    }
    const lossDelta = bookInPool - physicalCount;
    const totalLoss = historicalLoss + lossDelta;
    const lossRate = inPoolCount > 0 ? Number(((totalLoss / inPoolCount) * 100).toFixed(2)) : 0;
    const isException = lossRate > 5.0;

    return {
      valid: true,
      lossDelta,
      totalLoss,
      lossRate,
      isException,
      reason: isException ? `累计损耗率已达 ${lossRate}%（超 5%），请填写损耗原因` : "损耗登记正常",
    };
  },

  // 5. 单票出库校验: 在池存活校验 + 订单一致性
  checkOutbound: ({ bookInPool, outboundCount, channelOrderCount }: OutboundCheck) => {
    if (outboundCount <= 0) return { valid: false, reason: "出库数量必须大于0" };
    if (outboundCount > bookInPool) {
      return { valid: false, reason: `在池存活不足: 申请出库 ${outboundCount} 只，当前批次在池仅剩 ${bookInPool} 只` };
    }
    if (outboundCount !== channelOrderCount) {
      return { valid: false, reason: `出库数量 (${outboundCount}) 与渠道订单数量 (${channelOrderCount}) 不一致` };
    }
    return { valid: true, remainingInPool: bookInPool - outboundCount, reason: "出库校验通过" };
  },

  // 6. 蟹扣逐日轧平对账: 领扣 = 绑扣 + 退回 + 作废
  checkDailyBalance: ({ claimedCount, boundCount, returnedCount, scrappedCount }: DailyTagBalanceCheck) => {
    const accounted = boundCount + returnedCount + scrappedCount;
    const diff = claimedCount - accounted;
    const isBalanced = diff === 0;
    return {
      isBalanced,
      diff,
      reason: isBalanced
        ? "当日蟹扣数量已轧平"
        : `数量未轧平: 当日领扣 ${claimedCount} 只，已核销 ${accounted} 只（绑扣 ${boundCount} + 退回 ${returnedCount} + 作废 ${scrappedCount}），差额 ${diff} 只`,
    };
  },

  // 7. 冷库规格化库存计算与出库拦截 (PRD V2.1)
  // 可出库存 = 分拣合格数累计 − 出库单占用 (待审核 + 已出库)
  checkColdStorageOutbound: ({
    availableCount,
    requestedCount,
    spec = "指定规格",
    gender = "MALE",
  }: ColdStorageInventoryCheck) => {
    if (requestedCount <= 0) {
      return { valid: false, reason: "出库数量必须大于 0" };
    }
    if (requestedCount > availableCount) {
      const genderText = gender.includes("母") || gender === "FEMALE" ? "母蟹" : "公蟹";
      return {
        valid: false,
        availableCount,
        requestedCount,
        reason: `${genderText} ${spec} 冷库可出库库存不足：需 ${requestedCount} 只，现仅 ${availableCount} 只（分拣合格累计 − 已出库占用）`,
      };
    }
    return {
      valid: true,
      availableCount,
      requestedCount,
      remaining: availableCount - requestedCount,
      reason: "冷库库存充足，允许出库申请",
    };
  },

  // 7.1 流转环节通用余量卡控 (保鲜入库 / 分拣建单)
  checkStageQuota: ({
    totalCount,
    usedCount,
    reqCount,
    status,
    code,
    spec,
    stageName,
    actionName,
  }: {
    totalCount: number;
    usedCount: number;
    reqCount: number;
    status?: string;
    code?: string;
    spec?: string;
    stageName: string;
    actionName: string;
  }) => {
    const label = `${code ? ` [${code}]` : ""}${spec ? ` [${spec}]` : ""}`;
    if (status && status !== "COMPLETED") {
      return {
        valid: false,
        availableCount: 0,
        reason: `${stageName}${label}尚未完成（当前状态：${status}），暂不可${actionName}`,
      };
    }
    const availableCount = Math.max(0, totalCount - usedCount);
    if (reqCount <= 0) {
      return { valid: false, availableCount, reason: "投入数量必须大于 0" };
    }
    if (availableCount <= 0) {
      return {
        valid: false,
        availableCount: 0,
        reason: `${stageName}${label}已无可流转余量（已全部${actionName}），禁止重复建单！`,
      };
    }
    if (reqCount > availableCount) {
      return {
        valid: false,
        availableCount,
        excess: reqCount - availableCount,
        reason: `超额${actionName}拦截：申请 ${reqCount} 只，该${stageName}${label}当前仅剩 ${availableCount} 只（合格 ${totalCount} 只，已${actionName} ${usedCount} 只）`,
      };
    }
    return {
      valid: true,
      availableCount,
      remaining: availableCount - reqCount,
      reason: `${stageName}余量核验通过，准予${actionName}（本次 ${reqCount} 只，剩余 ${availableCount - reqCount} 只）`,
    };
  },

  checkColdIntake: (p: ColdIntakeCheck) =>
    Invariants.checkStageQuota({
      totalCount: p.qualifiedCount,
      usedCount: p.alreadyIntakeCount,
      reqCount: p.intakeCount,
      status: p.taskStatus,
      code: p.taskCode,
      stageName: "分拣批次",
      actionName: "入库登记",
    }),

  checkSortTaskIntake: (p: SortTaskIntakeCheck) =>
    Invariants.checkStageQuota({
      totalCount: p.bundleLineCount,
      usedCount: p.alreadySortedCount,
      reqCount: p.inputCount,
      status: p.bundleStatus,
      code: p.bundleCode,
      spec: p.spec,
      stageName: "捆扎批次",
      actionName: "创建分拣任务",
    }),

  // 8. 加工环节通用损耗计算与 5% 红线告警 (分拣/捆扎)
  calculateProcessLoss: ({ inputCount, qualifiedCount }: ProcessLossCheck, stage = "加工") => {
    if (inputCount <= 0) {
      return { valid: false, lossCount: 0, lossRate: 0, isException: true, reason: "投入数量必须大于 0" };
    }
    if (qualifiedCount > inputCount) {
      return { valid: false, lossCount: 0, lossRate: 0, isException: true, reason: "合格只数不能大于投入只数" };
    }
    const lossCount = inputCount - qualifiedCount;
    const lossRate = Number(((lossCount / inputCount) * 100).toFixed(2));
    const isException = lossRate > 5.0;
    return {
      valid: true,
      lossCount,
      lossRate,
      isException,
      reason: isException
        ? `${stage}损耗率达 ${lossRate}%（超 5% 阈值告警），需记录异常说明`
        : `${stage}正常，损耗 ${lossCount} 只（损耗率 ${lossRate}%）`,
    };
  },
  calculateSortingLoss: (check: ProcessLossCheck) => Invariants.calculateProcessLoss(check, "分拣"),
  calculateBundleLoss: (check: ProcessLossCheck) => Invariants.calculateProcessLoss(check, "捆扎"),

  // 8.1 批次全环节生命周期损耗汇聚 (暂养 + 捆扎 + 分拣 + 冷库发货)
  calculateBatchLifecycleLoss: (batch: {
    inPoolCount: number;
    lossCount?: number;
    lossRecords?: any[];
    bundleBatches?: any[];
  }) => {
    const holdingLoss = batch.lossCount ?? (batch.lossRecords?.reduce((s, r) => s + (r.lossCount || 0), 0) ?? 0);
    let bundlingLoss = 0;
    let sortingLoss = 0;
    let coldLoss = 0;

    if (batch.bundleBatches) {
      for (const bb of batch.bundleBatches) {
        if (bb.status === "COMPLETED") {
          bundlingLoss += bb.lossCount || 0;
        }
        if (bb.sortTasks) {
          for (const st of bb.sortTasks) {
            if (st.status === "COMPLETED") {
              sortingLoss += st.lossCount || 0;
            }
            if (st.coldLogs) {
              for (const cl of st.coldLogs) {
                if (cl.outboundLosses) {
                  for (const ol of cl.outboundLosses) {
                    coldLoss += ol.count || 0;
                  }
                }
              }
            }
          }
        }
      }
    }

    const totalLoss = holdingLoss + bundlingLoss + sortingLoss + coldLoss;
    const totalLossRate = batch.inPoolCount > 0 ? Number(((totalLoss / batch.inPoolCount) * 100).toFixed(2)) : 0;
    const isLossOverLimit = totalLossRate > 5.0;

    return {
      holdingLoss,
      bundlingLoss,
      sortingLoss,
      coldLoss,
      totalLoss,
      totalLossRate,
      isLossOverLimit,
    };
  },

  // 9. 蟹卡规格型号正则智能拆分 (PRD V2.1)
  parseCrabCardSpec: (specModel: string): ParsedSpecItem[] => {
    if (!specModel || typeof specModel !== "string") return [];
    const pattern = /(?:([0-9]+(?:\.[0-9]+)?)\s*(?:两)?\s*(公|母)|(公|母)(?:蟹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:两)?)(?:蟹)?\s*(?:[×✕✖\*＊xX共各\+/\-]|只\s*[\*×xX])?\s*(\d+)(?:只)?/g;
    return Array.from(specModel.matchAll(pattern))
      .map((match) => {
        const rawWeight = match[1] || match[4];
        const sex = match[2] || match[3];
        const count = parseInt(match[5], 10);
        return {
          gender: (sex === "母" ? "FEMALE" : "MALE") as "FEMALE" | "MALE",
          weightTier: Invariants.normalizeWeightTier(rawWeight),
          count,
        };
      })
      .filter((item) => item.count > 0);
  },

  // 9.1 重量档位规格标准化 (如 "3两" / "3" / "3.0" -> "3.0两", "3.5" -> "3.5两")
  normalizeWeightTier: (val?: string | null, fallback = "4.0两"): string => {
    const m = val?.match(/(\d+(?:\.\d+)?)/);
    return m ? `${parseFloat(m[1]).toFixed(1)}两` : fallback;
  },

  // 按码单净重和单只规格估算只数：1 斤 = 10 两
  estimateCrabCount: (weightInJin: number, weightTier: string): number | null => {
    const liangPerCrab = Number.parseFloat(weightTier);
    if (!Number.isFinite(weightInJin) || weightInJin <= 0 || !Number.isFinite(liangPerCrab) || liangPerCrab <= 0) return null;
    return Math.round((weightInJin * 10) / liangPerCrab);
  },

  // 10. 日期安全解析与标准化 (严格锁定北京时间 Asia/Shanghai)
  normalizeDateStr: (val?: string | Date | null): string => {
    if (val instanceof Date && !isNaN(val.getTime())) {
      const s = val.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
      return s.slice(0, 10);
    }
    if (typeof val === "string") {
      const s = val.trim();
      // 1. YYYY[-/.年]M[-/.月]D (如 2026-09-08, 2026/9/8)
      let m = s.match(/(?:^|[^\d])(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
      if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

      // 2. M/D/YY 或 M/D/YYYY (Excel 常见美式短日期导出 9/8/26, 09/08/2026)
      m = s.match(/(?:^|[^\d])(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})(?:$|[^\d])/);
      if (m) {
        const year = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      }

      // 3. YYYYMMDD (如 20260908)
      m = s.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    const today = new Date();
    return today.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).slice(0, 10);
  },

  normalizeDate: (val?: string | Date | null): Date =>
    new Date(`${Invariants.normalizeDateStr(val)}T00:00:00.000Z`),

  parseImportDate: (val?: string | null): string | null => {
    const raw = val?.trim();
    if (
      !raw ||
      !/(?:20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}|\b20\d{6}\b|(?:^|[^\d])\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})(?:$|[^\d]))/.test(raw)
    ) {
      return null;
    }

    const normalized = Invariants.normalizeDateStr(raw);
    const date = new Date(`${normalized}T00:00:00.000Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
      ? normalized
      : null;
  },

  // 11. 蟹卡导入单行智能识别 (支持 Excel 多列复制/格式自适应)
  parseCrabCardImportLine: (line: string): RawImportOrder[] => {
    const trimmed = line.trim();
    if (!trimmed || (/(?:订单号|序号|单号|提货单号|NO|No|ID)/i.test(trimmed) && /(?:规格|发货|日期|型号)/.test(trimmed))) return [];

    const cells = trimmed.split(trimmed.includes("\t") ? "\t" : /\s+/).map((c) => c.trim()).filter(Boolean);
    const isDate = (c: string) => /(?:20\d{2}[-/.]\d{1,2}|20\d{2}年|\b20\d{6}\b|^\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})$)/.test(c);
    const dateCell = cells.find(isDate);
    const deliveryDate = Invariants.normalizeDateStr(dateCell || trimmed);

    // 识别规格明细
    const items = Invariants.parseCrabCardSpec(trimmed);
    // 守恒硬约束：必须有明确的规格与只数明细；无规格行绝对禁止虚构订单
    if (items.length === 0) return [];

    const isSpec = (c: string) => /(?:公|母)/.test(c);

    // 识别订单号与型号（排除日期、规格、条码与表头字段关键字）
    const orderNo =
      cells.find((c) => !isDate(c) && !isSpec(c) && /^[A-Za-z0-9_-]{6,}$/.test(c)) ||
      cells[0] ||
      `KK${Date.now()}`;

    const otherParts = cells.filter(
      (c) =>
        !isDate(c) &&
        !isSpec(c) &&
        c !== orderNo &&
        !/^\d{10,14}$/.test(c) &&
        !/(?:提货单号|发货单号|单号|规格|型号|发货|日期)/.test(c)
    );
    const modelName =
      otherParts.join(" ").trim() ||
      trimmed.match(/([^\s\t(（,，]+(?:礼盒|装|型|卡|套餐|尊享))/)?.[1]?.trim() ||
      "";

    const base = {
      orderNo,
      type: "CRAB_CARD" as const,
      storeName: modelName ? `蟹卡提货 (${modelName})` : "蟹卡提货",
      deliveryDate,
      isPreSplit: true,
    };

    return items.map((it) => {
      const spec = `${it.weightTier}${it.gender === "FEMALE" ? "母蟹" : "公蟹"}×${it.count}只`;
      return {
        ...base,
        specModel: modelName ? `${modelName} (${spec})` : spec,
        gender: it.gender,
        weightTier: it.weightTier,
        count: it.count,
      };
    });
  },

  // 12. 门店订单单行智能识别 (支持图二：发货时间+门店+[门店编号]+4.0公蟹+只数，系统自动编排订单号)
  parseStoreOrderImportLine: (
    line: string,
    defaultStoreName = "山姆会员店"
  ): RawImportOrder | null => {
    const trimmed = line.trim();
    if (!trimmed || (/(?:发货|日期|单号|序号|门店|提货)/.test(trimmed) && /(?:规格|只数|公母|时间|型号)/.test(trimmed))) return null;

    const cells = trimmed.split(trimmed.includes("\t") ? "\t" : /\s+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) return null;

    // 1. 日期识别 (支持 20260904, 2026-09-04, 2026/9/4, 9/8/26)
    const isDate = (c: string) => /(?:20\d{2}[-/.]\d{1,2}|20\d{2}年|\b20\d{6}\b|^\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})$)/.test(c);
    const dateCell = cells.find(isDate);
    const deliveryDate = dateCell ? Invariants.parseImportDate(dateCell) : null;
    if (!deliveryDate) throw new Error("缺少有效发货日期");
    const dateCompact = deliveryDate.replace(/-/g, "");

    // 2. 规格与公母识别 (支持单列合并规格如 "4.0公蟹" / "5.0公" / "3.5母蟹"，或传统分列 "公" + "4.0两")
    let gender: "MALE" | "FEMALE" | null = null;
    let weightTier: string | null = null;
    let specCell: string | undefined;
    let genderCell: string | undefined;
    let weightCell: string | undefined;

    const combinedMatch = cells.find(
      (c) => !isDate(c) && /(?:([1-9](?:\.[0-9])?)(?:两)?(公|母)(?:蟹)?|(公|母)(?:蟹)?([1-9](?:\.[0-9])?)(?:两)?)/.test(c)
    );

    if (combinedMatch) {
      specCell = combinedMatch;
      const m = combinedMatch.match(/([1-9](?:\.[0-9])?)(?:两)?(公|母)/) || combinedMatch.match(/(公|母)([1-9](?:\.[0-9])?)/);
      if (m) {
        const rawWeight = m[1] && !/公|母/.test(m[1]) ? m[1] : m[2];
        const rawSex = /公|母/.test(m[1]) ? m[1] : m[2];
        gender = rawSex === "母" ? "FEMALE" : "MALE";
        weightTier = Invariants.normalizeWeightTier(rawWeight);
      }
    } else {
      genderCell = cells.find((c) => !isDate(c) && (/^(母|母蟹|female)$/i.test(c) || /^(公|公蟹|male)$/i.test(c)));
      if (!genderCell) throw new Error("缺少有效公母规格");
      gender = /母|female/i.test(genderCell) ? "FEMALE" : "MALE";
      weightCell = cells.find((c) => !isDate(c) && c !== genderCell && /^([1-9](?:\.[0-9])?)(?:两)?$/.test(c));
      if (!weightCell) throw new Error("缺少有效重量规格");
      weightTier = Invariants.normalizeWeightTier(weightCell);
    }
    if (!gender || !weightTier) throw new Error("缺少有效规格");

    // 3. 提取数量 (最后一个数字单元格) 与门店/订单信息
    const remaining = cells.filter((c) => c !== dateCell && c !== specCell && c !== genderCell && c !== weightCell);
    const numIdx = remaining.reduce((acc, c, idx) => (/^\d+只?$/.test(c) ? idx : acc), -1);
    if (numIdx === -1) throw new Error("缺少有效只数");
    const count = parseInt(remaining[numIdx], 10);
    if (!Number.isInteger(count) || count <= 0) throw new Error("只数必须是正整数");

    let explicitOrderNo: string | undefined;
    let storeCodeCell: string | undefined;
    let storeName: string | undefined;

    remaining.forEach((c, idx) => {
      if (idx === numIdx) return;
      if (/^(?:SO|ORDER|DD|SM)[A-Za-z0-9_-]{4,}|^[A-Za-z0-9_-]{8,}$/i.test(c)) explicitOrderNo = c;
      else if (/^\d{1,6}$/.test(c) || /^(?:ST|MD)[-_]?[A-Za-z0-9]+$/i.test(c)) storeCodeCell = c;
      else if (/[\u4e00-\u9fa5]/.test(c) || !storeName) storeName = c;
    });
    storeName = storeName || defaultStoreName;

    // 4. 订单号生成 (无外部订单号时：发货时间 + 门店编号/门店简称 + 规格，当天同店同规格全局唯一)
    let orderNo = explicitOrderNo;
    if (!orderNo) {
      const cleanStore = (storeName || "")
        .replace(/[()（）]|山姆会员店|盒马鲜生|会员店|直供店|山姆|盒马|门店|店/g, "")
        .trim();
      const storeTag = storeCodeCell || cleanStore || "MD";
      const specTag = `${weightTier.replace("两", "")}${gender === "FEMALE" ? "母" : "公"}`;
      orderNo = `SO${dateCompact}-${storeTag}-${specTag}`;
    }

    return {
      orderNo,
      type: "STORE_ORDER",
      storeName,
      gender,
      weightTier,
      count,
      deliveryDate,
      isPreSplit: true,
    };
  },

  // 13. 发货计划矩阵二维表智能识别与行转列展开 (PRD V2.2)
  parseStoreMatrixPlanText: (text: string, defaultYear = new Date().getFullYear()): RawImportOrder[] => {
    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    // 1. 识别整表默认日期；存在“发货日期”列时以每行日期为准
    const titleDate = text.match(/(?:(20\d{2})年?)?(\d{1,2})月(\d{1,2})日/);
    const deliveryDate = titleDate
      ? `${titleDate[1] || defaultYear}-${titleDate[2].padStart(2, "0")}-${titleDate[3].padStart(2, "0")}`
      : Invariants.parseImportDate(text);
    // 2. 查找规格列所在表头行 (含 2.5母, 3.5公, 3.0母, 4.0公 等)
    let specHeaderIndex = -1;
    let specColumns: Array<{ colIdx: number; weightTier: string; gender: "MALE" | "FEMALE"; specTag: string }> = [];
    let storeNameCol = 0;
    let storeCodeCol = 1;
    let orderNoCol = -1;
    let deliveryDateCol = -1;

    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split(lines[i].includes("\t") ? "\t" : /\s+/).map((c) => c.trim());
      const foundSpecs: typeof specColumns = [];

      cells.forEach((cell, idx) => {
        const spec = parseStoreSpecHeader(cell);
        if (spec) foundSpecs.push({ colIdx: idx, ...spec });
      });

      if (foundSpecs.length >= 2) {
        specHeaderIndex = i;
        specColumns = foundSpecs;

        // 识别门店名称与门店编号所在列
        cells.forEach((cell, idx) => {
          if (/发货地点|门店名称|门店名/.test(cell)) storeNameCol = idx;
          if (/门店编号|门店代码|门店号/.test(cell) || (cell === "门店" && idx !== storeNameCol)) storeCodeCol = idx;
          if (/^(订单号|原始单号)$/.test(cell)) orderNoCol = idx;
          if (/^(发货日期|发货时间|日期)$/.test(cell)) deliveryDateCol = idx;
        });
        break;
      }
    }

    if (specHeaderIndex === -1 || specColumns.length === 0) return [];

    // 3. 逐行解析门店发货数据并转换为标准订单
    const orders: RawImportOrder[] = [];
    for (let i = specHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^(合计|总计|汇总)/.test(line)) continue;
      const cells = line.split(line.includes("\t") ? "\t" : /\s+/).map((c) => c.trim());
      if (cells.length < 2) continue;

      const storeName = cells[storeNameCol] || cells[0];
      const storeCode = cells[storeCodeCol] || cells.find((c, idx) => idx !== storeNameCol && /^\d{3,6}$/.test(c)) || "";
      if (!storeName || /^(发货|业务|渠道|苏州|合计)/.test(storeName)) continue;

      const explicitOrderNo = orderNoCol >= 0 ? cells[orderNoCol] : "";
      if (orderNoCol >= 0 && !explicitOrderNo) throw new Error(`第 ${i + 1} 行缺少订单号`);

      const rowDate = deliveryDateCol >= 0
        ? Invariants.parseImportDate(cells[deliveryDateCol])
        : Invariants.parseImportDate(deliveryDate);
      if (!rowDate) throw new Error(`第 ${i + 1} 行缺少有效发货日期`);
      const dateCompact = rowDate.replace(/-/g, "");

      const storeTag = storeCode || storeName.replace(/[()（）]/g, "").replace(/山姆会员店|山姆店|店/g, "").trim() || "MD";

      for (const col of specColumns) {
        const val = cells[col.colIdx];
        if (!val) continue;
        if (!/^\d+$/.test(val)) throw new Error(`第 ${i + 1} 行 ${col.specTag} 只数必须是非负整数`);
        const count = Number(val);
        if (count > 0) {
          const orderNo = explicitOrderNo || `SO${dateCompact}-${storeTag}-${col.specTag}`;
          orders.push({
            orderNo,
            type: "STORE_ORDER",
            storeName,
            storeCode,
            gender: col.gender,
            weightTier: col.weightTier,
            count,
            deliveryDate: rowDate,
            isPreSplit: true,
          });
        }
      }
    }

    return orders;
  },

  // 14. 多行批量文本智能拆单解析 (自适应矩阵式计划表与单行平铺格式)
  parseOrderImportText: (
    text: string,
    type: "STORE" | "CARD",
    defaultStoreName = "山姆会员店"
  ): RawImportOrder[] => {
    if (type === "CARD") {
      return text.trim().split("\n").flatMap((line) => Invariants.parseCrabCardImportLine(line));
    }

    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    const matrixOrders = Invariants.parseStoreMatrixPlanText(text);
    if (matrixOrders.length > 0) return matrixOrders;

    // 默认平铺逐行解析
    return lines.flatMap((line, index) => {
      try {
        const item = Invariants.parseStoreOrderImportLine(line, defaultStoreName);
        return item ? [item] : [];
      } catch (error) {
        throw new Error(`第 ${index + 1} 行：${error instanceof Error ? error.message : "格式错误"}`);
      }
    });
  },

  // 15. 冷库各规格可出库存动态聚合与同规格合并 (PRD V2.3)
  // 彻底消除由于输入差异（如 "3两" 与 "3.0两"）导致的未合并重叠展示问题
  aggregateSpecStocks({
    sortTasks = [],
    outboundLines = [],
    outboundLosses = [],
    defaultSpecs = [
      { gender: "MALE", weightTier: "4.0两" },
      { gender: "MALE", weightTier: "3.5两" },
      { gender: "FEMALE", weightTier: "3.5两" },
      { gender: "FEMALE", weightTier: "3.0两" },
    ],
  }: {
    sortTasks: Array<{ gender: string; weightTier: string; qualifiedCount: number }>;
    outboundLines?: Array<{ gender: string; weightTier: string; count: number }>;
    outboundLosses?: Array<{ gender: string; weightTier: string; count: number }>;
    defaultSpecs?: Array<{ gender: string; weightTier: string }>;
  }) {
    const stockMap = new Map<string, { qualified: number; used: number; loss: number }>();
    for (const t of sortTasks) {
      const k = `${t.gender}_${Invariants.normalizeWeightTier(t.weightTier)}`;
      const e = stockMap.get(k) || { qualified: 0, used: 0, loss: 0 };
      e.qualified += t.qualifiedCount || 0;
      stockMap.set(k, e);
    }
    for (const l of outboundLines) {
      const k = `${l.gender}_${Invariants.normalizeWeightTier(l.weightTier)}`;
      const e = stockMap.get(k) || { qualified: 0, used: 0, loss: 0 };
      e.used += l.count || 0;
      stockMap.set(k, e);
    }
    for (const l of outboundLosses) {
      const k = `${l.gender}_${Invariants.normalizeWeightTier(l.weightTier)}`;
      const e = stockMap.get(k) || { qualified: 0, used: 0, loss: 0 };
      e.loss += l.count || 0;
      stockMap.set(k, e);
    }

    // 真实规格全部保留；不足 4 项时才拿 defaultSpecs 补足 4 项，不切片不顶替
    const finalKeys = new Set<string>(stockMap.keys());
    for (const d of defaultSpecs) {
      if (finalKeys.size >= 4) break;
      finalKeys.add(`${d.gender}_${Invariants.normalizeWeightTier(d.weightTier)}`);
    }

    return [...finalKeys]
      .map((k) => {
        const [gender, weightTier] = k.split("_");
        const { qualified = 0, used = 0, loss = 0 } = stockMap.get(k) || {};
        const available = Math.max(0, qualified - used - loss);
        return {
          gender,
          weightTier,
          label: `${weightTier} ${gender === "FEMALE" ? "母蟹" : "公蟹"}`,
          qualified,
          used,
          loss,
          available,
          usagePct: qualified > 0 ? Math.min(100, Math.round(((used + loss) / qualified) * 100)) : 0,
        };
      })
      .sort((a, b) =>
        a.gender !== b.gender
          ? a.gender === "MALE"
            ? -1
            : 1
          : parseFloat(b.weightTier) - parseFloat(a.weightTier)
      );
  },
};
