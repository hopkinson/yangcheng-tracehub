"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { safeRevalidate } from "@/lib/revalidate";
import { normalizeEnclosureCodes, validateEnclosureCodes } from "@/lib/enclosures";
import { getBeijingYear } from "@/lib/utils";

/**
 * 校验养殖户姓名是否在指定自然年度内重复
 */
export async function checkFarmerNameAction(data: {
  name: string;
  excludeFarmerId?: string;
  year?: number;
}) {
  try {
    await requireRole(["FARMER_ADMIN", "ADMIN"]);
    const cleanName = data.name.trim();
    if (!cleanName) return { exists: false };
    const targetYear = data.year || getBeijingYear();

    const existing = await prisma.farmer.findFirst({
      where: {
        name: cleanName,
        year: targetYear,
        ...(data.excludeFarmerId ? { id: { not: data.excludeFarmerId } } : {}),
      },
      select: { id: true, code: true, name: true },
    });

    return {
      exists: !!existing,
      conflictingFarmer: existing ? { code: existing.code, name: existing.name } : undefined,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * 校验围网编号是否存在跨养殖户冲突
 */
export async function checkEnclosureCodesAction(data: {
  enclosureCodes: string[];
  excludeFarmerId?: string;
}) {
  try {
    await requireRole(["FARMER_ADMIN", "ADMIN"]);

    const enclosureCodes = Array.from(new Set(normalizeEnclosureCodes(data.enclosureCodes)));
    if (enclosureCodes.length === 0) return { conflicts: [] as Array<{ code: string; farmerName: string; farmerCode: string }> };

    const conflicts = await prisma.enclosure.findMany({
      where: {
        code: { in: enclosureCodes },
        ...(data.excludeFarmerId ? { farmerId: { not: data.excludeFarmerId } } : {}),
      },
      select: {
        code: true,
        farmer: {
          select: { name: true, code: true },
        },
      },
    });

    return {
      conflicts: conflicts.map((item) => ({
        code: item.code,
        farmerName: item.farmer?.name || "未知养殖户",
        farmerCode: item.farmer?.code || "未知编号",
      })),
    };
  } catch {
    return { conflicts: [] as Array<{ code: string; farmerName: string; farmerCode: string }> };
  }
}

export async function createFarmerAction(data: {
  name: string;
  phone?: string;
  area: number;
  creditRating: string;
  enclosureCodes: string[]; // e.g. ["W-01", "W-02"]
  contractName?: string;
  contractUrl?: string;
  userId: string;
}) {
  try {
    await requireRole(["FARMER_ADMIN", "ADMIN"]);
    return await prisma.$transaction(async (tx) => {
      const currentYear = getBeijingYear();
      const cleanName = data.name.trim();

      // 1. 养殖户姓名录入全校验与查重（同年度全系统唯一，不得重复建档）
      if (!cleanName || cleanName.length < 2) {
        return { success: false as const, error: "养殖户姓名至少 2 个字符" };
      }
      const duplicateName = await tx.farmer.findFirst({
        where: { name: cleanName, year: currentYear },
        select: { id: true, code: true, name: true },
      });
      if (duplicateName) {
        return {
          success: false as const,
          error: `养殖户姓名「${cleanName}」在 ${currentYear} 年度档案中已存在（档案编号: ${duplicateName.code}），不得重复录入`,
        };
      }

      // 2. 围网编号格式与自身查重校验
      const check = validateEnclosureCodes(data.enclosureCodes);
      if (!check.valid) {
        return { success: false as const, error: check.error! };
      }
      const enclosureCodes = check.normalized;

      // 3. 围网编号全系统查重：必须全局唯一，不得跨养殖户重复占用
      const conflictingEnclosures = await tx.enclosure.findMany({
        where: { code: { in: enclosureCodes } },
        include: { farmer: { select: { name: true, code: true } } },
      });
      if (conflictingEnclosures.length > 0) {
        const details = conflictingEnclosures
          .map((c) => `「${c.code}」（占用养殖户: ${c.farmer?.name} ${c.farmer?.code}）`)
          .join("、");
        return {
          success: false as const,
          error: `围网编号已被其他养殖户占用，不得重复录入：${details}`,
        };
      }

      // 4. 健壮流水号生成（提取当年规范档案号最大序号累加，避免物理删除历史户碰撞）
      const existingFarmersThisYear = await tx.farmer.findMany({
        where: { code: { startsWith: `JD-${currentYear}-` } },
        select: { code: true },
      });
      const maxNum = existingFarmersThisYear.reduce(
        (max, f) => Math.max(max, parseInt(f.code.slice(8) || "0", 10)),
        0
      );
      const code = `JD-${currentYear}-${String(maxNum + 1).padStart(3, "0")}`;
      const quota = Math.round(data.area * 600);

      const farmer = await tx.farmer.create({
        data: {
          code,
          name: cleanName,
          phone: data.phone || "",
          farmType: "LAKE_CRAB",
          year: currentYear,
          area: data.area,
          quota,
          creditRating: data.creditRating || "A",
          status: "ACTIVE",
          contractName: data.contractName,
          contractUrl: data.contractUrl,
          enclosures: {
            create: enclosureCodes.map((code) => ({ code })),
          },
        },
        include: { enclosures: true },
      });

      await tx.auditLog.create({
        data: {
          operatorId: data.userId,
          action: "CREATE_FARMER",
          entityType: "FARMER",
          entityId: farmer.id,
          details: JSON.stringify({ code: farmer.code, name: farmer.name, quota: farmer.quota }),
        },
      });

      safeRevalidate("/farmers");
      safeRevalidate("/batches");
      safeRevalidate("/ledgers");
      return { success: true as const, data: farmer };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetStr = JSON.stringify(error.meta || "");
      if (targetStr.includes("Farmer_code") || (error.meta?.modelName === "Farmer" && targetStr.includes("code"))) {
        return { success: false as const, error: "系统分配的养殖户编号冲突，请重试保存" };
      }
      if (targetStr.includes("Farmer_name") || targetStr.includes("name")) {
        return { success: false as const, error: "养殖户姓名已被占用，不得重复" };
      }
      return { success: false as const, error: "围网编号已被其他养殖户使用，请更换编号" };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "创建养殖户档案失败",
    };
  }
}

export async function updateFarmerAction(data: {
  id: string;
  name: string;
  phone?: string;
  area: number;
  creditRating: string;
  status: string;
  enclosureCodes: string[];
  contractName?: string;
  contractUrl?: string;
  userId: string;
}) {
  try {
    await requireRole(["FARMER_ADMIN", "ADMIN"]);
    return await prisma.$transaction(async (tx) => {
      const cleanName = data.name.trim();
      const quota = Math.round(data.area * 600);

      const targetFarmer = await tx.farmer.findUniqueOrThrow({
        where: { id: data.id },
      });

      // 1. 养殖户姓名全校验与查重（排除自身，其他同年度档案不得同名）
      if (!cleanName || cleanName.length < 2) {
        return { success: false as const, error: "养殖户姓名至少 2 个字符" };
      }
      const duplicateName = await tx.farmer.findFirst({
        where: {
          name: cleanName,
          year: targetFarmer.year,
          id: { not: data.id },
        },
        select: { id: true, code: true, name: true },
      });
      if (duplicateName) {
        return {
          success: false as const,
          error: `养殖户姓名「${cleanName}」在 ${targetFarmer.year} 年度已被其他档案使用（档案编号: ${duplicateName.code}），不得重复`,
        };
      }

      // 2. 围网编号格式与自身查重校验
      const check = validateEnclosureCodes(data.enclosureCodes);
      if (!check.valid) {
        return { success: false as const, error: check.error! };
      }
      const enclosureCodes = check.normalized;

      // 3. 围网编号跨养殖户查重校验：排除当前养殖户，其余养殖户不得存在同名围网
      const conflictingEnclosures = await tx.enclosure.findMany({
        where: {
          code: { in: enclosureCodes },
          farmerId: { not: data.id },
        },
        include: { farmer: { select: { name: true, code: true } } },
      });
      if (conflictingEnclosures.length > 0) {
        const details = conflictingEnclosures
          .map((c) => `「${c.code}」（占用养殖户: ${c.farmer?.name} ${c.farmer?.code}）`)
          .join("、");
        return {
          success: false as const,
          error: `围网编号已被其他养殖户占用，不得重复：${details}`,
        };
      }

      let existingEnclosures = await tx.enclosure.findMany({
        where: { farmerId: data.id },
        include: { batches: true },
      });

      // 4. 自动自愈：清理同归一化编码下无批次的幽灵重复项（兼容历史脏数据）
      const grouped = Object.groupBy(existingEnclosures, (e) => normalizeEnclosureCodes([e.code])[0] || "");
      const ghostIds = Object.values(grouped).flatMap((list = []) => {
        const hasBatches = list.filter((e) => e.batches.length > 0);
        return hasBatches.length <= 1 ? list.filter((e) => e.batches.length === 0).map((e) => e.id) : [];
      });
      if (ghostIds.length > 0) {
        await tx.enclosure.deleteMany({ where: { id: { in: ghostIds } } });
        existingEnclosures = existingEnclosures.filter((e) => !ghostIds.includes(e.id));
      }

      // 5. 编码归一化匹配已有围网并自动规范化已有编码
      const codeToExisting = new Map(existingEnclosures.map((e) => [normalizeEnclosureCodes([e.code])[0], e]));

      const matchedIds = new Set<string>();
      const unmatchedNew: string[] = [];

      for (const code of enclosureCodes) {
        const matched = codeToExisting.get(code);
        if (matched) {
          matchedIds.add(matched.id);
          if (matched.code !== code) {
            await tx.enclosure.update({ where: { id: matched.id }, data: { code } });
          }
        } else {
          unmatchedNew.push(code);
        }
      }

      let unmatchedOld = existingEnclosures.filter((e) => !matchedIds.has(e.id));

      // 6. 1对1未匹配认定为围网更名 (保留批次外键绑定)
      if (unmatchedOld.length === 1 && unmatchedNew.length === 1) {
        await tx.enclosure.update({ where: { id: unmatchedOld[0].id }, data: { code: unmatchedNew[0] } });
        unmatchedOld = [];
        unmatchedNew.length = 0;
      }

      // 7. 拦截有批次的围网被直接丢弃，其余执行删除与新增
      const blocked = unmatchedOld.find((e) => e.batches.length > 0);
      if (blocked) {
        return { success: false as const, error: `围网「${blocked.code}」已有关联的原料批次，无法直接移除或替换` };
      }

      if (unmatchedOld.length > 0) {
        await tx.enclosure.deleteMany({ where: { id: { in: unmatchedOld.map((e) => e.id) } } });
      }
      if (unmatchedNew.length > 0) {
        await tx.enclosure.createMany({ data: unmatchedNew.map((code) => ({ code, farmerId: data.id })) });
      }

      const farmer = await tx.farmer.update({
        where: { id: data.id },
        data: {
          name: cleanName,
          phone: data.phone,
          farmType: "LAKE_CRAB",
          area: data.area,
          quota,
          creditRating: data.creditRating,
          status: data.status,
          contractName: data.contractName,
          contractUrl: data.contractUrl,
        },
        include: { enclosures: true },
      });

      await tx.auditLog.create({
        data: {
          operatorId: data.userId,
          action: "UPDATE_FARMER",
          entityType: "FARMER",
          entityId: farmer.id,
          details: JSON.stringify({ code: farmer.code, quota: farmer.quota, status: farmer.status }),
        },
      });

      safeRevalidate("/farmers");
      safeRevalidate("/batches");
      safeRevalidate("/ledgers");
      return { success: true as const, data: farmer };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetStr = JSON.stringify(error.meta || "");
      if (targetStr.includes("Farmer_name") || targetStr.includes("name")) {
        return { success: false as const, error: "养殖户姓名已被其他档案使用，不得重复" };
      }
      return { success: false as const, error: "围网编号已被其他养殖户使用，请更换编号" };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "更新养殖户档案失败",
    };
  }
}
