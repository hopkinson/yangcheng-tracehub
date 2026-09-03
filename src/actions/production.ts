"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { getTenant } from "@/config/tenant";

// ============================================================================
// 1. 订单管理 Server Actions
// ============================================================================

export interface RawImportOrder {
  orderNo: string;
  type: "STORE_ORDER" | "CRAB_CARD";
  storeName?: string;
  specModel?: string;
  gender: string;
  weightTier: string;
  count: number;
  deliveryDate: string; // YYYY-MM-DD
}

export async function importOrdersAction(rawOrders: RawImportOrder[]) {
  try {
    if (!rawOrders || rawOrders.length === 0) {
      return { success: false, message: "导入订单列表不能为空" };
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const importId = `IM${dateStr}${Math.floor(10 + Math.random() * 90)}`;

    const ordersToCreate: any[] = [];
    let idx = 1;

    for (const raw of rawOrders) {
      if (raw.type === "CRAB_CARD" && raw.specModel) {
        // 使用正则智能拆分多规格行
        const parsedItems = Invariants.parseCrabCardSpec(raw.specModel);
        if (parsedItems.length > 0) {
          for (const item of parsedItems) {
            ordersToCreate.push({
              code: `SO${dateStr}${String(idx++).padStart(3, "0")}`,
              importId,
              orderNo: raw.orderNo,
              type: "CRAB_CARD",
              storeName: "蟹卡提货 (顺丰速运直发)",
              specModel: raw.specModel,
              gender: item.gender,
              weightTier: item.weightTier,
              count: item.count,
              deliveryDate: new Date(raw.deliveryDate),
              status: "PENDING",
            });
          }
          continue;
        }
      }

      // 门店订单或普通单
      ordersToCreate.push({
        code: `SO${dateStr}${String(idx++).padStart(3, "0")}`,
        importId,
        orderNo: raw.orderNo,
        type: raw.type,
        storeName: raw.storeName || getTenant().storeLabel,
        specModel: raw.specModel || null,
        gender: raw.gender === "母" || raw.gender === "FEMALE" ? "FEMALE" : "MALE",
        weightTier: raw.weightTier.endsWith("两") ? raw.weightTier : `${raw.weightTier}两`,
        count: Number(raw.count),
        deliveryDate: new Date(raw.deliveryDate),
        status: "PENDING",
      });
    }

    await prisma.order.createMany({
      data: ordersToCreate,
    });

    revalidatePath("/orders");
    revalidatePath("/");
    return {
      success: true,
      importId,
      createdCount: ordersToCreate.length,
      message: `成功导入 ${ordersToCreate.length} 条发货需求（批次号：${importId}）`,
    };
  } catch (error: any) {
    console.error("importOrdersAction error:", error);
    return { success: false, message: error.message || "导入订单失败" };
  }
}

export async function deleteOrderBatchAction(importId: string, orderNo?: string) {
  try {
    const whereClause: any = { importId, status: "PENDING" };
    if (orderNo) {
      whereClause.orderNo = orderNo;
    }

    // 检查是否有已发货订单
    const shippedCount = await prisma.order.count({
      where: { importId, status: "SHIPPED", ...(orderNo ? { orderNo } : {}) },
    });

    if (shippedCount > 0) {
      return { success: false, message: "该批次包含已发货订单，不可整单删除" };
    }

    const res = await prisma.order.deleteMany({
      where: whereClause,
    });

    revalidatePath("/orders");
    revalidatePath("/");
    return { success: true, message: `已成功删除 ${res.count} 条待发货订单记录` };
  } catch (error: any) {
    console.error("deleteOrderBatchAction error:", error);
    return { success: false, message: error.message || "删除订单失败" };
  }
}

// ============================================================================
// 2. 捆扎管理 Server Actions
// ============================================================================

export async function createBundleBatchAction(data: {
  groupId: string;
  tagClaimId: string;
  ropeBatch: string;
  lines: Array<{ poolId: string; gender: string; weightTier: string; count: number }>;
}) {
  try {
    if (!data.groupId || !data.tagClaimId || !data.ropeBatch.trim()) {
      return { success: false, message: "捆扎班组、蟹扣批次与蟹绳批次均为必填项" };
    }
    if (!data.lines || data.lines.length === 0 || data.lines.some((l) => l.count <= 0)) {
      return { success: false, message: "必须至少选择一个有效来源池并输入正确只数" };
    }

    // 校验蟹扣是否为 APPROVED 状态
    const tagClaim = await prisma.tagClaim.findUnique({
      where: { id: data.tagClaimId },
    });
    if (!tagClaim || tagClaim.status !== "APPROVED") {
      return { success: false, message: "所选蟹扣批次未通过审核，禁止用于捆扎" };
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.bundleBatch.count();
    const code = `KZD${dateStr}${String(count + 1).padStart(2, "0")}`;

    const batch = await prisma.bundleBatch.create({
      data: {
        code,
        groupId: data.groupId,
        tagClaimId: data.tagClaimId,
        ropeBatch: data.ropeBatch.trim(),
        status: "BUNDLING",
        lines: {
          create: data.lines.map((l) => ({
            poolId: l.poolId,
            gender: l.gender,
            weightTier: l.weightTier,
            count: l.count,
          })),
        },
      },
      include: { lines: true },
    });

    // 捆扎组状态更新为 BUNDLING
    await prisma.bundleGroup.update({
      where: { id: data.groupId },
      data: { status: "BUNDLING" },
    });

    revalidatePath("/bundling");
    revalidatePath("/");
    return { success: true, code, message: `捆扎批次 ${code} 创建成功，进入【捆扎中】状态` };
  } catch (error: any) {
    console.error("createBundleBatchAction error:", error);
    return { success: false, message: error.message || "创建捆扎批次失败" };
  }
}

export async function completeBundleBatchAction(bundleId: string) {
  try {
    const batch = await prisma.bundleBatch.findUnique({
      where: { id: bundleId },
    });
    if (!batch) return { success: false, message: "未找到指定的捆扎批次" };

    await prisma.bundleBatch.update({
      where: { id: bundleId },
      data: {
        status: "COMPLETED",
        doneAt: new Date(),
      },
    });

    // 捆扎组置为 COMPLETED
    await prisma.bundleGroup.update({
      where: { id: batch.groupId },
      data: { status: "COMPLETED" },
    });

    revalidatePath("/bundling");
    revalidatePath("/sorting");
    revalidatePath("/");
    return { success: true, message: `捆扎批次 ${batch.code} 已确认完成，可进入分拣环节` };
  } catch (error: any) {
    console.error("completeBundleBatchAction error:", error);
    return { success: false, message: error.message || "确认完成捆扎失败" };
  }
}

export async function createBundleGroupAction(name: string) {
  try {
    const count = await prisma.bundleGroup.count();
    const code = `P${count + 1}`;
    await prisma.bundleGroup.create({
      data: { code, name: name.trim() || `捆扎${count + 1}组` },
    });
    revalidatePath("/bundling");
    return { success: true, message: `捆扎班组 ${name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建班组失败" };
  }
}

export async function deleteBundleGroupAction(groupId: string) {
  try {
    const batchCount = await prisma.bundleBatch.count({ where: { groupId } });
    if (batchCount > 0) {
      return { success: false, message: "该班组名下存在历史捆扎批次，禁止删除" };
    }
    await prisma.bundleGroup.delete({ where: { id: groupId } });
    revalidatePath("/bundling");
    return { success: true, message: "捆扎班组已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除班组失败" };
  }
}

// ============================================================================
// 3. 分拣称重 Server Actions
// ============================================================================

export async function createSortTaskAction(data: {
  machineId: string;
  bundleBatchId: string;
  gender: string;
  weightTier: string;
  inputCount: number;
}) {
  try {
    const machine = await prisma.sortMachine.findUnique({ where: { id: data.machineId } });
    if (!machine || machine.status !== "ACTIVE") {
      return { success: false, message: "分拣设备未启用或不存在" };
    }
    if (machine.lastCalibrationStatus === "EXCEPTION") {
      return { success: false, message: "设备校准未通过，安全联锁启动，禁止开机作业" };
    }

    const bundle = await prisma.bundleBatch.findUnique({
      where: { id: data.bundleBatchId },
      include: { lines: true },
    });
    if (!bundle || bundle.status !== "COMPLETED") {
      return { success: false, message: "只有【已完成】的捆扎批次才允许进入分拣任务" };
    }

    const matchedLine = bundle.lines.find(
      (l: { gender: string; weightTier: string; count: number }) =>
        l.gender === data.gender && l.weightTier === data.weightTier
    );
    const maxAllowed = matchedLine ? matchedLine.count : 0;
    if (data.inputCount <= 0 || data.inputCount > maxAllowed) {
      return { success: false, message: `投入只数超出捆扎该规格总数（上限 ${maxAllowed} 只）` };
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.sortTask.count();
    const code = `FJR${dateStr}${String(count + 1).padStart(2, "0")}`;

    await prisma.sortTask.create({
      data: {
        code,
        machineId: data.machineId,
        bundleBatchId: data.bundleBatchId,
        gender: data.gender,
        weightTier: data.weightTier,
        inputCount: data.inputCount,
        status: "PENDING",
      },
    });

    revalidatePath("/sorting");
    revalidatePath("/");
    return { success: true, code, message: `分拣任务 ${code} 创建成功，等待上机称重` };
  } catch (error: any) {
    console.error("createSortTaskAction error:", error);
    return { success: false, message: error.message || "创建分拣任务失败" };
  }
}

export async function completeSortTaskAction(taskId: string, qualifiedCount: number) {
  try {
    const task = await prisma.sortTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, message: "分拣任务未找到" };

    const lossRes = Invariants.calculateSortingLoss({
      inputCount: task.inputCount,
      qualifiedCount,
    });

    if (!lossRes.valid) {
      return { success: false, message: lossRes.reason };
    }

    await prisma.sortTask.update({
      where: { id: taskId },
      data: {
        qualifiedCount,
        lossCount: lossRes.lossCount,
        lossRate: lossRes.lossRate,
        status: "COMPLETED",
        doneAt: new Date(),
      },
    });

    revalidatePath("/sorting");
    revalidatePath("/cold-storage");
    revalidatePath("/outbound");
    revalidatePath("/");
    return {
      success: true,
      isException: lossRes.isException,
      message: `分拣任务已完成！合格入库 ${qualifiedCount} 只，损耗 ${lossRes.lossCount} 只（${lossRes.lossRate}%）`,
    };
  } catch (error: any) {
    console.error("completeSortTaskAction error:", error);
    return { success: false, message: error.message || "完成分拣任务失败" };
  }
}

export async function calibrateMachineAction(machineId: string, status: "QUALIFIED" | "EXCEPTION" | "PENDING") {
  try {
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: {
        lastCalibratedAt: new Date(),
        lastCalibrationStatus: status,
      },
    });
    revalidatePath("/sorting");
    revalidatePath("/");
    const label = status === "QUALIFIED" ? "合格" : status === "EXCEPTION" ? "异常" : "待校验";
    return { success: true, message: `设备校准状态已更新为【${label}】` };
  } catch (error: any) {
    return { success: false, message: error.message || "校准状态更新失败" };
  }
}

export async function createSortMachineAction(name: string) {
  try {
    const count = await prisma.sortMachine.count();
    const code = `FJ-${String(count + 1).padStart(2, "0")}`;
    await prisma.sortMachine.create({
      data: {
        code,
        name: name.trim() || `分拣机 ${count + 1}`,
        status: "ACTIVE",
        lastCalibrationStatus: "QUALIFIED",
        lastCalibratedAt: new Date(),
      },
    });
    revalidatePath("/sorting");
    return { success: true, message: `分拣机 ${name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建分拣机失败" };
  }
}

export async function updateSortMachineNameAction(machineId: string, name: string) {
  try {
    if (!name.trim()) return { success: false, message: "分拣机名称不能为空" };
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: { name: name.trim() },
    });
    revalidatePath("/sorting");
    return { success: true, message: "分拣机名称已更新" };
  } catch (error: any) {
    return { success: false, message: error.message || "更新失败" };
  }
}

export async function toggleSortMachineStatusAction(machineId: string) {
  try {
    const m = await prisma.sortMachine.findUnique({ where: { id: machineId } });
    if (!m) return { success: false, message: "设备未找到" };
    const nextStatus = m.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: { status: nextStatus },
    });
    revalidatePath("/sorting");
    return { success: true, message: `设备已${nextStatus === "ACTIVE" ? "启用" : "停用"}` };
  } catch (error: any) {
    return { success: false, message: error.message || "切换状态失败" };
  }
}

export async function deleteSortMachineAction(machineId: string) {
  try {
    const taskCount = await prisma.sortTask.count({ where: { machineId } });
    if (taskCount > 0) {
      return { success: false, message: "该分拣设备名下存在历史分拣任务，禁止删除！" };
    }
    await prisma.sortMachine.delete({ where: { id: machineId } });
    revalidatePath("/sorting");
    return { success: true, message: "分拣机已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除失败" };
  }
}


// ============================================================================
// 4. 保鲜预冷 Server Actions
// ============================================================================

export async function createColdIntakeAction(data: {
  storeId: string;
  count: number;
  refType?: string;
  refId?: string;
  operator: string;
}) {
  try {
    if (data.count <= 0) return { success: false, message: "入库只数必须大于 0" };

    const count = await prisma.coldLog.count();
    const code = `CR-${String(count + 901).padStart(4, "0")}`;

    await prisma.coldLog.create({
      data: {
        code,
        storeId: data.storeId,
        type: "INTAKE",
        count: data.count,
        refType: data.refType || "SORT",
        refId: data.refId || null,
        operator: data.operator || "李仓管",
      },
    });

    revalidatePath("/cold-storage");
    revalidatePath("/");
    return { success: true, code, message: `入库登记成功，生成入库单号 ${code}` };
  } catch (error: any) {
    console.error("createColdIntakeAction error:", error);
    return { success: false, message: error.message || "预冷入库登记失败" };
  }
}

export async function createColdStoreAction(data: { name: string; targetTemp: number }) {
  try {
    const count = await prisma.coldStore.count();
    const code = `BX-${String(count + 1).padStart(2, "0")}`;
    await prisma.coldStore.create({
      data: {
        code,
        name: data.name.trim(),
        targetTemp: Number(data.targetTemp) || 4.5,
      },
    });
    revalidatePath("/cold-storage");
    return { success: true, message: `保鲜库位 ${data.name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建保鲜库位失败" };
  }
}

export async function updateColdStoreAction(storeId: string, data: { name: string; targetTemp: number }) {
  try {
    if (!data.name.trim()) return { success: false, message: "库位名称不能为空" };
    await prisma.coldStore.update({
      where: { id: storeId },
      data: {
        name: data.name.trim(),
        targetTemp: Number(data.targetTemp) || 4.5,
      },
    });
    revalidatePath("/cold-storage");
    return { success: true, message: "保鲜库位信息已更新" };
  } catch (error: any) {
    return { success: false, message: error.message || "更新保鲜库位失败" };
  }
}

export async function deleteColdStoreAction(storeId: string) {
  try {
    const logCount = await prisma.coldLog.count({ where: { storeId } });
    if (logCount > 0) {
      return { success: false, message: "该保鲜库名下存在入库台账存量，禁止删除" };
    }
    await prisma.coldStore.delete({ where: { id: storeId } });
    revalidatePath("/cold-storage");
    return { success: true, message: "保鲜库位已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除保鲜库位失败" };
  }
}
