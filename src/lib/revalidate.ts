import { revalidatePath } from "next/cache";

/**
 * 安全触发路径缓存刷新，在单元测试或无 Next.js 请求上下文中静默忽略缺失 store 异常
 */
export function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // 忽略在非 Next.js 请求上下文（如测试环境）中的静态生成 store 缺失错误
  }
}
