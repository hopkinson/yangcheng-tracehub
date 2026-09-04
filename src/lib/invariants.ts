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
  cumulativeClaimed: number;
  activeInPoolCount: number;
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

export interface SortingLossCheck {
  inputCount: number;
  qualifiedCount: number;
}

export interface ParsedSpecItem {
  gender: "MALE" | "FEMALE";
  weightTier: string;
  count: number;
}

export interface RawImportOrder {
  orderNo: string;
  type: "STORE_ORDER" | "CRAB_CARD";
  storeName?: string;
  specModel?: string;
  gender: string;
  weightTier: string;
  count: number;
  deliveryDate: string; // YYYY-MM-DD
  isPreSplit?: boolean;
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

  // 3. 蟹扣领用余量计算与校验: min(在池存活合计, 剩余额度)
  checkTagClaim: ({ farmerQuota, cumulativeClaimed, activeInPoolCount, requestedCount }: TagClaimCheck) => {
    const remainingQuota = Math.max(0, farmerQuota - cumulativeClaimed);
    const maxClaimable = Math.min(activeInPoolCount, remainingQuota);
    const valid = requestedCount > 0 && requestedCount <= maxClaimable;
    return {
      valid,
      maxClaimable,
      activeInPoolCount,
      remainingQuota,
      reason: valid ? "领用数量在合规余量范围内" : `超领拦截: 申请 ${requestedCount} 只，当前可领上限为 ${maxClaimable} 只`,
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

  // 7.1 分拣合格品入库保鲜预冷余量卡控 (PRD V2.1)
  // 入库数量不得多于分拣合格剩余未入库只数: count <= qualifiedCount - alreadyIntakeCount
  checkColdIntake: ({
    qualifiedCount,
    alreadyIntakeCount,
    intakeCount,
    taskStatus,
    taskCode,
  }: ColdIntakeCheck) => {
    if (taskStatus && taskStatus !== "COMPLETED") {
      return {
        valid: false,
        availableCount: 0,
        reason: `分拣批次${taskCode ? ` [${taskCode}] ` : ""}尚未完成称重分拣（当前状态：${taskStatus}），暂不可办理保鲜预冷入库`,
      };
    }
    const availableCount = Math.max(0, qualifiedCount - alreadyIntakeCount);
    if (intakeCount <= 0) {
      return { valid: false, availableCount, reason: "入库数量必须大于 0" };
    }
    if (intakeCount > availableCount) {
      return {
        valid: false,
        availableCount,
        excess: intakeCount - availableCount,
        reason: `超额入库拦截：申请入库 ${intakeCount} 只，该分拣批次${taskCode ? ` [${taskCode}] ` : ""}当前仅剩 ${availableCount} 只可入库（分拣合格 ${qualifiedCount} 只，已预冷入库 ${alreadyIntakeCount} 只）`,
      };
    }
    return {
      valid: true,
      availableCount,
      remaining: availableCount - intakeCount,
      reason: `分拣批次余量核验通过，准予入库登记（入库 ${intakeCount} 只，入库后剩余 ${availableCount - intakeCount} 只）`,
    };
  },

  // 8. 分拣称重损耗计算与 5% 红线告警 (PRD V2.1)
  calculateSortingLoss: ({ inputCount, qualifiedCount }: SortingLossCheck) => {
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
        ? `分拣损耗率达 ${lossRate}%（超 5% 阈值告警），需记录异常说明`
        : `分拣正常，损耗 ${lossCount} 只（损耗率 ${lossRate}%）`,
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
        const formattedWeight = rawWeight.includes(".") ? rawWeight : `${rawWeight}.0`;
        return {
          gender: (sex === "母" ? "FEMALE" : "MALE") as "FEMALE" | "MALE",
          weightTier: `${formattedWeight}两`,
          count,
        };
      })
      .filter((item) => item.count > 0);
  },

  // 10. 日期安全解析与标准化
  normalizeDate: (val?: string | Date | null): Date => {
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === "string") {
      const s = val.trim();
      const m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/) || s.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
      if (m) {
        const d = new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00.000Z`);
        if (!isNaN(d.getTime())) return d;
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  },

  normalizeDateStr: (val?: string | Date | null): string => Invariants.normalizeDate(val).toISOString().slice(0, 10),

  // 11. 蟹卡导入单行智能识别 (支持 Excel 多列复制/格式自适应)
  parseCrabCardImportLine: (line: string): RawImportOrder[] => {
    const trimmed = line.trim();
    if (!trimmed || (/^(订单号|序号|单号|NO|No|ID)/i.test(trimmed) && /(规格|发货|日期|型号)/.test(trimmed))) return [];

    const cells = trimmed.split(trimmed.includes("\t") ? "\t" : /\s+/).map((c) => c.trim()).filter(Boolean);
    const isDate = (c: string) => /(?:20\d{2}[-/.]\d{1,2}|20\d{2}年|\b20\d{6}\b)/.test(c);
    const dateCell = cells.find(isDate);
    const deliveryDate = Invariants.normalizeDateStr(dateCell || trimmed);

    // 识别规格明细
    const items = Invariants.parseCrabCardSpec(trimmed);
    const isSpec = (c: string) => /(?:公|母)/.test(c);

    // 识别订单号与型号（排除日期、规格与条码）
    const orderNo = cells.find((c) => !isDate(c) && !isSpec(c) && /^[A-Za-z0-9_-]{6,}$/.test(c)) || cells[0] || `KK${Date.now()}`;
    const otherParts = cells.filter((c) => !isDate(c) && !isSpec(c) && c !== orderNo && !/^\d{10,14}$/.test(c));
    const modelName = otherParts.join(" ").trim();

    const base = {
      orderNo,
      type: "CRAB_CARD" as const,
      storeName: modelName ? `蟹卡提货 (${modelName})` : "蟹卡提货",
      deliveryDate,
      isPreSplit: true,
    };

    const targetItems = items.length ? items : [{ gender: "FEMALE" as const, weightTier: "3.5两", count: 10 }];

    return targetItems.map((it) => {
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

  // 12. 门店订单单行智能识别
  parseStoreOrderImportLine: (line: string, defaultStoreName = "山姆会员店"): RawImportOrder | null => {
    const trimmed = line.trim();
    if (!trimmed || (/^(订单号|序号|单号|NO|No|ID)/i.test(trimmed) && /(门店|规格|只数|日期)/.test(trimmed))) return null;

    const cells = trimmed.split(trimmed.includes("\t") ? "\t" : /\s+/).map((c) => c.trim()).filter(Boolean);
    const isDate = (c: string) => /(?:20\d{2}[-/.]\d{1,2}|20\d{2}年|\b20\d{6}\b)/.test(c);
    const dateCell = cells.find(isDate);
    const deliveryDate = Invariants.normalizeDateStr(dateCell || trimmed);

    const genderCell = cells.find((c) => !isDate(c) && (/^(母|母蟹|female)$/i.test(c) || /^(公|公蟹|male)$/i.test(c)));
    const gender: "MALE" | "FEMALE" = genderCell && /母|female/i.test(genderCell) ? "FEMALE" : "MALE";

    const weightCell = cells.find((c) => !isDate(c) && c !== genderCell && /^([1-9](?:\.[0-9])?)(?:两)?$/.test(c));
    const weightTier = weightCell ? (weightCell.endsWith("两") ? weightCell : `${Number(weightCell).toFixed(1)}两`) : "4.0两";

    const countCell = cells.find((c) => !isDate(c) && c !== genderCell && c !== weightCell && /^\d+(?:只)?$/.test(c));
    const count = countCell ? parseInt(countCell, 10) : 100;

    const orderNo = cells.find((c) => !isDate(c) && c !== genderCell && c !== weightCell && c !== countCell && /^[A-Za-z0-9_-]{6,}$/.test(c)) || cells[0] || `SO${Date.now()}`;

    const storeCell = cells.find((c) => !isDate(c) && c !== genderCell && c !== weightCell && c !== countCell && c !== orderNo);
    const storeName = storeCell || defaultStoreName;

    return { orderNo, type: "STORE_ORDER", storeName, gender, weightTier, count, deliveryDate, isPreSplit: true };
  },

  // 13. 多行批量文本智能拆单解析
  parseOrderImportText: (
    text: string,
    type: "STORE" | "CARD",
    defaultStoreName = "山姆会员店"
  ): RawImportOrder[] => {
    return text.trim().split("\n").flatMap((line) => {
      if (!line.trim()) return [];
      if (type === "CARD") return Invariants.parseCrabCardImportLine(line);
      const item = Invariants.parseStoreOrderImportLine(line, defaultStoreName);
      return item ? [item] : [];
    });
  },
};

