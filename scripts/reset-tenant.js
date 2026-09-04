const { PrismaClient } = require("@prisma/client");
const { parseArgs } = require("node:util");
const readline = require("node:readline");
const path = require("node:path");
const { execSync } = require("node:child_process");

const TENANTS = {
  default: { id: "default", name: "阳澄湖大闸蟹溯源品控系统", companyName: "阳澄股份", channelName: "山姆专用", storeLabel: "山姆会员店" },
  maoshi: { id: "maoshi", name: "毛氏阳澄大闸蟹溯源品控系统", companyName: "苏州市毛氏阳澄湖水产发展有限公司", channelName: "餐饮专用", storeLabel: "餐饮门店" },
};

// 1. 原生解析参数 (Node 18+ stdlib)
const { values: args } = parseArgs({
  options: {
    tenant: { type: "string", short: "t" },
    force: { type: "boolean", short: "f", default: false },
    db: { type: "string" },
    phone: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
  },
  strict: false,
});

const rawTenant = (args.tenant || process.env.NEXT_PUBLIC_TENANT || process.env.TENANT || "default").toLowerCase();
const tenant = TENANTS[rawTenant === "yc" || rawTenant === "yangcheng" ? "default" : rawTenant] || TENANTS.default;

// 2. 原生加载环境配置 (Node 20+ stdlib)
for (const envFile of [`.env.${tenant.id}`, ".env.production", ".env"]) {
  try { process.loadEnvFile?.(path.resolve(process.cwd(), envFile)); } catch {}
}

const customDbUrl = args.db || process.env.DATABASE_URL;
const prisma = new PrismaClient(customDbUrl ? { datasources: { db: { url: customDbUrl } } } : undefined);

async function askConfirm(promptText) {
  if (args.force || process.argv.includes("-y") || process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(promptText, (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === "yes"); }));
}

async function main() {
  console.log(`\n🛠️  分系统重置与单超管初始化: 【${tenant.name}】 (${tenant.id})`);
  console.log(`💾 数据库: ${customDbUrl || "默认"}`);

  if (!(await askConfirm("⚠️ 输入 'yes' 确认清空所有业务数据并保留单超管: "))) {
    console.log("🚫 操作已取消。");
    return;
  }

  // 表结构就绪检测 (全新库自愈)
  try { await prisma.user.count(); } catch (err) {
    if (err && err.code === "P2021") {
      console.log("⚡ 自动同步表结构 (prisma db push)...");
      execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit", env: { ...process.env, DATABASE_URL: customDbUrl || process.env.DATABASE_URL } });
    }
  }

  // 倒序清空所有业务表
  const models = [
    "qCRecord", "specialApproval", "auditLog", "lossRecord",
    "outboundLine", "outboundOrder", "order",
    "coldLog", "coldStore", "sortTask", "sortMachine",
    "bundleLine", "bundleBatch", "bundleGroup", "tagClaim",
    "batchItem", "batch", "holdingPool", "enclosure", "farmer",
    "store", "channel", "user"
  ];
  for (const m of models) if (prisma[m]) await prisma[m].deleteMany().catch(() => {});

  // 初始化专属渠道与唯一超管
  const isMaoshi = tenant.id === "maoshi";
  const defaultChannelCode = isMaoshi ? "CATERING" : "SAMS";
  const channel = await prisma.channel.create({
    data: {
      code: defaultChannelCode,
      name: isMaoshi ? "餐饮连锁专属渠道" : "山姆会员商店 (专属配载)",
      stores: { create: [{ code: `${defaultChannelCode}-01`, name: `${tenant.storeLabel} (示范店)` }] },
    },
  });

  const adminPhone = args.phone || process.env.INITIAL_ADMIN_PHONE || (isMaoshi ? "13800000008" : "13800000001");
  const adminPassword = args.password || process.env.INITIAL_ADMIN_PASSWORD || "Admin#2026!";
  const admin = await prisma.user.create({
    data: {
      username: isMaoshi ? "admin_maoshi" : "admin_yangcheng",
      phone: adminPhone,
      passwordHash: adminPassword,
      fullName: args.name || process.env.INITIAL_ADMIN_NAME || `${tenant.companyName}超级管理员`,
      role: "ADMIN",
      channelId: channel.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: admin.id,
      action: "SYSTEM_INITIALIZE",
      entityType: "SYSTEM",
      entityId: tenant.id,
      details: JSON.stringify({ tenantId: tenant.id, adminPhone, resetAt: new Date().toISOString() }),
    },
  });

  console.log(`\n✅ 【${tenant.name}】已初始化完毕！`);
  console.log(`👤 超管姓名: ${admin.fullName} | 📱 手机: ${admin.phone} | 🔑 密码: ${adminPassword} | 🛡️ 角色: ${admin.role}\n`);
}

main().catch((e) => { console.error("❌ 失败:", e); process.exit(1); }).finally(() => prisma.$disconnect());
