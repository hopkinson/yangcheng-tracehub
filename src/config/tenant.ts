export interface TenantConfig {
  id: string;
  name: string;
  companyName: string;
  channelName: string;
  storeLabel: string;
  logo: string;
  logoDark: string;
  emblem: string;
  favicon: string;
  icon: string;
}

export const TENANTS: Record<string, TenantConfig> = {
  default: {
    id: "default",
    name: "阳澄湖大闸蟹溯源品控系统",
    companyName: "阳澄股份",
    channelName: "山姆专用",
    storeLabel: "山姆会员店",
    logo: "/logo-brand.png",
    logoDark: "/logo-brand-dark.png",
    emblem: "/logo-emblem.png",
    favicon: "/favicon.ico",
    icon: "/icon.png",
  },
  maoshi: {
    id: "maoshi",
    name: "毛氏阳澄大闸蟹溯源品控系统",
    companyName: "苏州市毛氏阳澄湖水产发展有限公司",
    channelName: "餐饮专用",
    storeLabel: "餐饮门店",
    logo: "/tenants/maoshi/logo.png",
    logoDark: "/tenants/maoshi/logo-dark.png",
    emblem: "/tenants/maoshi/logo-emblem.png",
    favicon: "/tenants/maoshi/favicon.ico",
    icon: "/tenants/maoshi/icon.png",
  },
};

export function getTenant(): TenantConfig {
  let tenantId = process.env.NEXT_PUBLIC_TENANT || process.env.TENANT;
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-tenant");
    if (attr && TENANTS[attr]) {
      tenantId = attr;
    }
  }
  return TENANTS[tenantId || "default"] || TENANTS.default;
}
