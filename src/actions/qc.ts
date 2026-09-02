"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export interface CreateQCRecordData {
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

export async function createQCRecordAction(data: CreateQCRecordData) {
  try {
    if (!data.cat || !data.refId || !data.checkTime) {
      return { success: false, message: "记录类别、关联对象与巡检时间均为必填项" };
    }

    // 结论推导: 首项为合格，包含"异常"、"暂停"、"待整改"或提供理由的为 EXCEPTION
    let result = "QUALIFIED";
    if (
      data.reason?.trim() ||
      data.conclusion?.includes("异常") ||
      data.conclusion?.includes("暂停") ||
      data.conclusion?.includes("待整改") ||
      data.conclusion?.includes("存在问题")
    ) {
      result = "EXCEPTION";
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.qCRecord.count();
    
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
    const code = `${prefix}${dateStr}${String(count + 1).padStart(2, "0")}`;

    await prisma.qCRecord.create({
      data: {
        code,
        cat: data.cat,
        formNo: data.formNo || null,
        refType: data.refType,
        refId: data.refId,
        title: data.title,
        checkTime: new Date(data.checkTime),
        uploadTime: new Date(),
        result,
        conclusion: data.conclusion || "全部指标合格",
        reason: data.reason?.trim() || null,
        uploader: data.uploader || "赵质检 (质检员)",
        fileName: data.fileName || `${code}_质检留痕原件.jpg`,
        fileUrl: data.fileUrl || null,
      },
    });

    revalidatePath("/", "layout");
    return { success: true, code, message: `品控记录 ${code} 上传成功` };
  } catch (error: any) {
    console.error("createQCRecordAction error:", error);
    return { success: false, message: error.message || "上传品控记录失败" };
  }
}

export async function deleteQCRecordAction(recordId: string) {
  try {
    await prisma.qCRecord.delete({ where: { id: recordId } });
    revalidatePath("/", "layout");
    return { success: true, message: "品控记录已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除记录失败" };
  }
}
