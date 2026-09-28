"use server";

import { uploadFileToStorage } from "@/lib/storage";

export interface UploadActionResult {
  success: boolean;
  url: string;
  name: string;
  message?: string;
}

export async function uploadFileAction(formData: FormData): Promise<UploadActionResult> {
  try {
    const file = formData.get("file") as File;
    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, url: "", name: "", message: "请提供有效的文件" };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, url: "", name: "", message: "文件大小不能超过 10MB" };
    }

    const result = await uploadFileToStorage(file);
    return { success: true, url: result.url, name: result.name };
  } catch (err: unknown) {
    console.error("uploadFileAction error:", err);
    const msg = err instanceof Error ? err.message : "文件上传处理失败";
    return { success: false, url: "", name: "", message: msg };
  }
}
