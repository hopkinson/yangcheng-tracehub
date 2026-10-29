"use server";

import { uploadFileToStorage } from "@/lib/storage";
import { requireRole } from "@/lib/auth";
import { REPORT_EXTENSIONS, REPORT_MIME_TYPES } from "@/lib/report-file-types";

export interface UploadActionResult {
  success: boolean;
  url: string;
  name: string;
  message?: string;
}

export async function uploadFileAction(formData: FormData): Promise<UploadActionResult> {
  try {
    await requireRole(["ADMIN", "WAREHOUSE_ADMIN", "QA_DIRECTOR", "FARMER_ADMIN"]);

    const file = formData.get("file") as File;
    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, url: "", name: "", message: "请提供有效的文件" };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, url: "", name: "", message: "文件大小不能超过 10MB" };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!REPORT_EXTENSIONS.has(ext) || (file.type && !REPORT_MIME_TYPES.has(file.type))) {
      return { success: false, url: "", name: "", message: "仅支持上传 PDF、JPG、PNG、WEBP 格式文件" };
    }

    const result = await uploadFileToStorage(file);
    return { success: true, url: result.url, name: result.name };
  } catch (err: unknown) {
    console.error("uploadFileAction error:", err);
    const msg = err instanceof Error ? err.message : "文件上传处理失败";
    return { success: false, url: "", name: "", message: msg };
  }
}
