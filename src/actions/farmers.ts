"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { findDuplicateEnclosureCodes, normalizeEnclosureCodes } from "@/lib/enclosures";

export async function checkEnclosureCodesAction(data: {
  enclosureCodes: string[];
  excludeFarmerId?: string;
}) {
  await requireRole(["FARMER_ADMIN", "ADMIN"]);

  const enclosureCodes = Array.from(new Set(normalizeEnclosureCodes(data.enclosureCodes)));
  if (enclosureCodes.length === 0) return { conflicts: [] as string[] };

  const conflicts = await prisma.enclosure.findMany({
    where: {
      code: { in: enclosureCodes },
      ...(data.excludeFarmerId ? { farmerId: { not: data.excludeFarmerId } } : {}),
    },
    select: { code: true },
  });

  return { conflicts: conflicts.map((item) => item.code) };
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
  await requireRole(["FARMER_ADMIN", "ADMIN"]);
  try {
    return await prisma.$transaction(async (tx) => {
    const currentYear = new Date().getFullYear();
    const enclosureCodes = normalizeEnclosureCodes(data.enclosureCodes);
    const duplicateCodes = findDuplicateEnclosureCodes(enclosureCodes);
    if (duplicateCodes.length > 0) {
      throw new Error(`围网编号重复：${duplicateCodes.join("、")}`);
    }
    if (enclosureCodes.length === 0) {
      throw new Error("请至少填写一个有效的围网编号");
    }

    const count = await tx.farmer.count({ where: { year: currentYear } });
    const code = `JD-${currentYear}-${String(count + 1).padStart(3, "0")}`;
    const quota = Math.round(data.area * 600);

    const farmer = await tx.farmer.create({
      data: {
        code,
        name: data.name,
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

    revalidatePath("/farmers");
    revalidatePath("/batches");
    revalidatePath("/ledgers");
    return farmer;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("围网编号已被其他养殖户使用，请更换编号");
    }
    throw error;
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
  await requireRole(["FARMER_ADMIN", "ADMIN"]);
  try {
    return await prisma.$transaction(async (tx) => {
    const quota = Math.round(data.area * 600);
    const enclosureCodes = normalizeEnclosureCodes(data.enclosureCodes);
    const duplicateCodes = findDuplicateEnclosureCodes(enclosureCodes);
    if (duplicateCodes.length > 0) {
      throw new Error(`围网编号重复：${duplicateCodes.join("、")}`);
    }
    if (enclosureCodes.length === 0) {
      throw new Error("请至少填写一个有效的围网编号");
    }

    const existingEnclosures = await tx.enclosure.findMany({
      where: { farmerId: data.id },
      include: { batches: true },
    });

    const newCodes = enclosureCodes;

    // 找出可以安全删除的（未被任何批次引用的旧围网且不在新列表中）
    const toDelete = existingEnclosures.filter(
      (e) => !newCodes.includes(e.code.trim().toUpperCase()) && e.batches.length === 0
    );
    if (toDelete.length > 0) {
      await tx.enclosure.deleteMany({
        where: { id: { in: toDelete.map((e) => e.id) } },
      });
    }

    // 找出需要新增的围网
    const existingCodes = new Set(existingEnclosures.map((e) => e.code.trim().toUpperCase()));
    const toCreate = newCodes.filter((code) => !existingCodes.has(code));
    if (toCreate.length > 0) {
      await tx.enclosure.createMany({
        data: toCreate.map((code) => ({
          code,
          farmerId: data.id,
        })),
      });
    }

    const farmer = await tx.farmer.update({
      where: { id: data.id },
      data: {
        name: data.name,
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

    revalidatePath("/farmers");
    revalidatePath("/batches");
    revalidatePath("/ledgers");
    return farmer;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("围网编号已被其他养殖户使用，请更换编号");
    }
    throw error;
  }
}
