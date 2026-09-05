import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export interface UploadResult {
  url: string;
  name: string;
}

export { getPreviewFileUrl } from "./utils";

/**
 * 阿里云 OSS REST PUT 直传 (原生 HMAC-SHA1 签名，零外部第三方依赖)
 */
async function uploadToAliyunOss(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucket = process.env.OSS_BUCKET!;
  const endpoint = process.env.OSS_ENDPOINT!.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
  let publicDomain = process.env.OSS_PUBLIC_DOMAIN?.trim();

  // 阿里云 OSS 域名纠错：
  // 若用户填写的 publicDomain 属于 *.aliyuncs.com 且未带 bucket 前缀，自动补齐以防被 OSS 当作 Path-Style 解析报 0003-00001403
  if (publicDomain && publicDomain.includes("aliyuncs.com") && !publicDomain.includes(bucket)) {
    const clean = publicDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    publicDomain = `https://${bucket}.${clean}`;
  }

  const date = new Date().toUTCString();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `reports/${Date.now()}_${safeFilename}`;
  const canonicalizedResource = `/${bucket}/${objectKey}`;

  // 阿里云 OSS 标准签名公式: HMAC-SHA1(AccessKeySecret, "PUT\n\n${contentType}\n${date}\n${resource}")
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalizedResource}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const host = `${bucket}.${endpoint}`;
  const uploadUrl = `https://${host}/${objectKey}`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Date: date,
      Authorization: `OSS ${accessKeyId}:${signature}`,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OSS 上传失败 [${res.status}]: ${errorText}`);
  }

  // 返回访问地址 (若配置了有效 CDN 域名则优先使用，否则使用 Virtual-Hosted 标准 OSS 地址)
  if (publicDomain) {
    const cleanPublic = publicDomain.startsWith("http") ? publicDomain : `https://${publicDomain}`;
    return `${cleanPublic.replace(/\/$/, "")}/${objectKey}`;
  }

  return uploadUrl;
}

/**
 * 阿里云 OSS REST DELETE (原生 HMAC-SHA1 签名)
 */
async function deleteFromAliyunOss(objectKey: string): Promise<void> {
  const bucket = process.env.OSS_BUCKET!;
  const endpoint = process.env.OSS_ENDPOINT!.replace(/^https?:\/\//, "");
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;

  const date = new Date().toUTCString();
  const canonicalizedResource = `/${bucket}/${objectKey}`;

  const stringToSign = `DELETE\n\n\n${date}\n${canonicalizedResource}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const host = `${bucket}.${endpoint}`;
  const deleteUrl = `https://${host}/${objectKey}`;

  const res = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Date: date,
      Authorization: `OSS ${accessKeyId}:${signature}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    console.error(`[OSS_DELETE_ERROR] [${res.status}]: ${errorText}`);
  }
}

/**
 * 本地开发存储 (保存至 public/uploads 静态目录)
 */
async function uploadToLocalStorage(buffer: Buffer, originalName: string): Promise<string> {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${timestamp}_${safeName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);

  return `/uploads/${filename}`;
}

/**
 * 统一文件上传入口
 * - 生产环境：只需在 .env 配置 OSS 环境变量，自动直传云端对象存储
 * - 本地环境：未配置 OSS 时自动保存到本地静态目录
 */
export async function uploadFileToStorage(file: File): Promise<UploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const contentType = file.type || "application/octet-stream";

  // 1. 如果已配置云端 OSS 凭证，走云端存储
  if (process.env.OSS_BUCKET && process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET && process.env.OSS_ENDPOINT) {
    try {
      const cloudUrl = await uploadToAliyunOss(buffer, file.name, contentType);
      return { url: cloudUrl, name: file.name };
    } catch (err) {
      console.error("[OSS_CLOUD_FALLBACK] 云端 OSS 上传异常，已降级至本地存储:", err);
    }
  }

  // 2. 默认本地存储模式
  const localUrl = await uploadToLocalStorage(buffer, file.name);
  return {
    url: localUrl,
    name: file.name,
  };
}

export async function deleteFileFromStorage(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  // 1. 本地存储路径 /uploads/...
  if (fileUrl.startsWith("/uploads/")) {
    const filename = path.basename(fileUrl);
    return fs.unlink(path.join(process.cwd(), "public", "uploads", filename)).catch(() => {});
  }

  // 2. 云端 OSS 路径
  if (
    process.env.OSS_BUCKET &&
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_ENDPOINT
  ) {
    try {
      const objectKey = new URL(fileUrl).pathname.replace(/^\//, "");
      if (objectKey) await deleteFromAliyunOss(objectKey);
    } catch (err) {
      console.error("[OSS_DELETE_ERROR]", err);
    }
  }
}

