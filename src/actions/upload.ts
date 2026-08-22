"use server";

import { uploadFileToStorage } from "@/lib/storage";

export async function uploadFileAction(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("请提供有效的文件");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("文件大小不能超过 10MB");
  }

  const result = await uploadFileToStorage(file);
  return result;
}
