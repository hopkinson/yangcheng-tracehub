"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createFarmerAction(data: {
  name: string;
  phone: string;
  farmType: string; // LAKE_CRAB, POND_CRAB
  area: number;
  creditRating: string;
  enclosureCodes: string[]; // e.g. ["W-01", "W-02"]
  userId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const currentYear = new Date().getFullYear();
    const count = await tx.farmer.count({ where: { year: currentYear } });
    const code = `JD-${currentYear}-${String(count + 1).padStart(3, "0")}`;
    const quota = Math.round(data.area * 600);

    const farmer = await tx.farmer.create({
      data: {
        code,
        name: data.name,
        phone: data.phone,
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
  phone: string;
  farmType: string;
  area: number;
  creditRating: string;
  status: string;
  enclosureCodes: string[];
  userId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const quota = Math.round(data.area * 600);

    // 删除已有围网并重新创建
    await tx.enclosure.deleteMany({
      where: { farmerId: data.id },
    });

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
        enclosures: {
          create: data.enclosureCodes.filter(c => c.trim()).map(code => ({ code: code.trim() })),
        },
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
