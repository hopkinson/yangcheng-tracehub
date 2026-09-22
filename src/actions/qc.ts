"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getBeijingDateStr, parseBeijingDateTime } from "@/lib/utils";
import { requireRole } from "@/lib/auth";

export interface CreateQCRecordData {
  id?: string;
  cat: string;
  formNo?: string;
  refType: string;
  refId: string;
  title: string;
  checkTime: string; // ISO or YYYY-MM-DDTHH:mm
  conclusion?: string;
  reason?: string;
  uploader?: string;
  fileName?: string;
  fileUrl?: string;
}

const FIXED_QC_TITLES: Record<string, string> = {
  QUICK_CHECK: "药残及重金属快检",
  TASTE_CHECK: "品质抽检与试吃记录",
  POOL_INSPECT: "暂养巡检记录",
  WATER_QUALITY: "暂养水质监测记录",
  BUNDLE_INSPECT: "捆扎作业巡检记录",
  SORT_CALIBRATE: "分拣设备精度校验记录",
  SORT_INSPECT: "分拣作业巡检记录",
  COLD_TEMP: "保鲜库信息记录表",
};

export async function createQCRecordAction(data: CreateQCRecordData) {
  try {
    if (data.refType === "BATCH" && (data.cat === "QUICK_CHECK" || data.cat === "TASTE_CHECK")) {
      await requireRole(["QA_DIRECTOR", "ADMIN", "WAREHOUSE_ADMIN"]);
    }

    if (!data.cat?.trim() || !data.refId?.trim() || !data.checkTime?.trim() || !data.uploader?.trim()) {
      return { success: false, message: "记录类别、关联对象、巡检时间与质检人员均为必填项" };
    }

    // 结论推导: 合格 (QUALIFIED)、不合格 (UNQUALIFIED)、待整改 (RECTIFYING)
    const rawConc = (data.conclusion || "").trim();
    let result = "QUALIFIED";
    if (rawConc === "不合格" || rawConc.includes("不合格")) {
      result = "UNQUALIFIED";
    } else if (rawConc === "待整改" || /待整改|暂停|整改|需复核/.test(rawConc)) {
      result = "RECTIFYING";
    } else if (rawConc === "合格" || /合格|符合|正常/.test(rawConc)) {
      result = "QUALIFIED";
    } else if (data.reason?.trim() || /异常|存在问题/.test(rawConc)) {
      result = "EXCEPTION";
    }

    const dateStr = getBeijingDateStr();

    // 生成前缀 (JC/SC/XJ/SZ/KZ/JZ/FJ/BX/BZ/CL)
    const prefixMap: Record<string, string> = {
      QUICK_CHECK: "JC",
      TASTE_CHECK: "SC",
      POOL_INSPECT: "XJ",
      WATER_QUALITY: "SZ",
      BUNDLE_INSPECT: "KZ",
      SORT_CALIBRATE: "JZ",
      SORT_INSPECT: "FJ",
      COLD_TEMP: "BX",
      PACK_INSPECT: "BZ",
      VEHICLE_INSPECT: "CL",
    };
    const prefix = prefixMap[data.cat] || "QC";
    const code = await prisma.$transaction(async (tx) => {
      let recordCode = "";
      const now = new Date();

      if (data.id) {
        const existing = await tx.qCRecord.findUnique({ where: { id: data.id } });
        if (!existing) {
          throw new Error("待修改的品控记录不存在");
        }
        await tx.qCRecord.update({
          where: { id: data.id },
          data: {
            cat: data.cat,
            formNo: data.formNo || null,
            refType: data.refType,
            refId: data.refId,
            title: FIXED_QC_TITLES[data.cat] || data.title,
            checkTime: parseBeijingDateTime(data.checkTime),
            result,
            conclusion: data.conclusion || "合格",
            reason: data.reason?.trim() || null,
            uploader: (data.uploader || "").trim(),
            fileName: data.fileUrl ? (data.fileName || existing.fileName || `${existing.code}_质检留痕原件.jpg`) : null,
            fileUrl: data.fileUrl || null,
          },
        });
        recordCode = existing.code;
      } else {
        const count = await tx.qCRecord.count();
        recordCode = `${prefix}${dateStr}${String(count + 1).padStart(2, "0")}`;

        await tx.qCRecord.create({
          data: {
            code: recordCode,
            cat: data.cat,
            formNo: data.formNo || null,
            refType: data.refType,
            refId: data.refId,
            title: FIXED_QC_TITLES[data.cat] || data.title,
            checkTime: parseBeijingDateTime(data.checkTime),
            uploadTime: now,
            result,
            conclusion: data.conclusion || "合格",
            reason: data.reason?.trim() || null,
            uploader: (data.uploader || "").trim(),
            fileName: data.fileUrl ? (data.fileName || `${recordCode}_质检留痕原件.jpg`) : null,
            fileUrl: data.fileUrl || null,
          },
        });
      }

      if (data.refType === "BATCH" && (data.cat === "QUICK_CHECK" || data.cat === "TASTE_CHECK")) {
        const status = result === "QUALIFIED" ? "QUALIFIED" : result === "RECTIFYING" ? "RECTIFYING" : "UNQUALIFIED";
        await tx.batch.update({
          where: { code: data.refId },
          data: data.cat === "QUICK_CHECK"
            ? {
                quickCheck: status,
                quickCheckUrl: data.fileUrl || null,
                quickCheckName: data.fileName || null,
                ...(data.fileUrl ? { reportUrl: data.fileUrl, reportName: data.fileName || null, reportUploadedAt: now } : {}),
              }
            : {
                sampleCheck: status,
                sampleCheckUrl: data.fileUrl || null,
                sampleCheckName: data.fileName || null,
              },
        });
      }

      return recordCode;
    });

    try {
      revalidatePath("/", "layout");
    } catch {}
    return {
      success: true,
      code,
      message: data.id ? `品控记录 ${code} 修改成功` : `品控记录 ${code} 上传成功`,
    };
  } catch (error: any) {
    console.error("createQCRecordAction error:", error);
    return { success: false, message: error.message || "上传品控记录失败" };
  }
}

export const saveQCRecordAction = createQCRecordAction;

export async function deleteQCRecordAction(recordId: string) {
  try {
    await prisma.qCRecord.delete({ where: { id: recordId } });
    try {
      revalidatePath("/", "layout");
    } catch {}
    return { success: true, message: "品控记录已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除记录失败" };
  }
}

export async function getQCInspectorsAction() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, fullName: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return users;
  } catch (error) {
    console.error("getQCInspectorsAction error:", error);
    return [];
  }
}
