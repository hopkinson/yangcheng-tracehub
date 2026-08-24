"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createFarmerAction(data: {
  name: string;
  phone?: string;
  farmType: string; // LAKE_CRAB, POND_CRAB
  area: number;
  creditRating: string;
  enclosureCodes: string[]; // e.g. ["W-01", "W-02"]
  userId: string;
}) {
  await requireRole(["FARMER_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const currentYear = new Date().getFullYear();
    const count = await tx.farmer.count({ where: { year: currentYear } });
    const code = `JD-${currentYear}-${String(count + 1).padStart(3, "0")}`;
    const quota = Math.round(data.area * 600);

    const farmer = await tx.farmer.create({
      data: {
        code,
        name: data.name,
        phone: data.phone || "",
        farmType: data.farmType,
        year: currentYear,
        area: data.area,
        quota,
        creditRating: data.creditRating || "A",
        status: "ACTIVE",
        enclosures: {
          create: data.enclosureCodes.filter(c => c.trim()).map(code => ({ code: code.trim() })),
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
}

export async function updateFarmerAction(data: {
  id: string;
  name: string;
  phone?: string;
  farmType: string;
  area: number;
  creditRating: string;
  status: string;
  enclosureCodes: string[];
  userId: string;
}) {
  await requireRole(["FARMER_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const quota = Math.round(data.area * 600);

    // 安全同步围网：保留已有且已被批次引用的围网，增加新围网
    const existingEnclosures = await tx.enclosure.findMany({
      where: { farmerId: data.id },
      include: { batches: true },
    });

    const newCodes = Array.from(new Set(data.enclosureCodes.map((c) => c.trim()).filter(Boolean)));

    // 找出可以安全删除的（未被任何批次引用的旧围网且不在新列表中）
    const toDelete = existingEnclosures.filter(
      (e) => !newCodes.includes(e.code) && e.batches.length === 0
    );
    if (toDelete.length > 0) {
      await tx.enclosure.deleteMany({
        where: { id: { in: toDelete.map((e) => e.id) } },
      });
    }

    // 找出需要新增的围网
    const existingCodes = existingEnclosures.map((e) => e.code);
    const toCreate = newCodes.filter((code) => !existingCodes.includes(code));
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
        farmType: data.farmType,
        area: data.area,
        quota,
        creditRating: data.creditRating,
        status: data.status,
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
}
