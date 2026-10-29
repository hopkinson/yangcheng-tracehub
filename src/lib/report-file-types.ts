/**
 * 检测报告附件的合法扩展名与 MIME 类型。
 * 注意：不能放在 "use server" 文件中导出 —— Next.js 规定 "use server" 模块
 * 只能导出异步函数，导出 Set 等对象会导致运行时 "A 'use server' file can
 * only export async functions, found object." 错误，进而使全站 server action 失效。
 */
export const REPORT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
export const REPORT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
