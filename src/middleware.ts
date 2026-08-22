import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isAuthenticated = !!session;

  const isLoginPage = pathname === "/login";
  const isPublicApi = pathname.startsWith("/api/health");

  if (isPublicApi) {
    return NextResponse.next();
  }

  // 1. 如果已登录，但访问登录页，直接跳转到首页
  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 2. 如果未登录，且访问受保护页面，重定向至登录页并附带原请求路径
  if (!isAuthenticated) {
    const redirectUrl = new URL("/login", request.url);
    const fullPath = pathname + search;
    if (fullPath && fullPath !== "/") {
      redirectUrl.searchParams.set("redirect", fullPath);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，排除：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public 目录下的静态文件（图片、svg等）
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
