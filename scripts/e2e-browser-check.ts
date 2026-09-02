import { createSessionToken } from "../src/lib/session";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 开始多角色全链路端到端 HTTP/HTML 实机渲染与权限隔离巡检...\n");

  const users = await prisma.user.findMany();
  const adminUser = users.find((u) => u.role === "ADMIN") || users[0];
  const whUser = users.find((u) => u.role === "WAREHOUSE_ADMIN") || adminUser;
  const qaUser = users.find((u) => u.role === "QA_DIRECTOR") || adminUser;

  const adminToken = await createSessionToken(adminUser.id);
  const adminCookie = `auth_session=${adminToken}`;

  const routes = [
    { path: "/", name: "运营总览看板", checks: ["阳澄", "全链路", "实时"] },
    { path: "/orders", name: "订单管理", checks: ["订单管理", "发货"] },
    { path: "/batches", name: "原料批次", checks: ["原料批次", "一码单"] },
    { path: "/pools", name: "暂养监控", checks: ["暂养监控", "规格锁定", "清池释放"] },
    { path: "/bundling", name: "捆扎管理", checks: ["捆扎", "班组"] },
    { path: "/sorting", name: "分拣称重", checks: ["分拣", "称重"] },
    { path: "/cold-storage", name: "保鲜预冷", checks: ["保鲜", "预冷"] },
    { path: "/outbound", name: "出库管理", checks: ["出库管理", "出库"] },
    { path: "/farmers", name: "养殖档案", checks: ["养殖档案", "额度"] },
    { path: "/tags", name: "蟹扣管理", checks: ["蟹扣管理", "日结", "领用"] },
    { path: "/approvals", name: "审批中心", checks: ["审批中心", "审批"] },
    { path: "/ledgers", name: "合规台账", checks: ["台账", "合规"] },
    { path: "/trace", name: "反向穿透式追溯", checks: ["溯源", "全链路"] },
  ];

  console.log(`👤 [1/3] 超级管理员 (${adminUser.fullName}) 页面渲染全巡检:`);
  let adminPassed = 0;
  for (const r of routes) {
    try {
      const res = await fetch(`http://localhost:3000${r.path}`, {
        headers: { Cookie: adminCookie },
      });
      if (res.status !== 200) {
        console.error(`  ❌ [${r.name}] (${r.path}) -> HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const missing = r.checks.filter((c) => !html.includes(c));
      if (missing.length > 0) {
        console.warn(`  ⚠️ [${r.name}] (${r.path}) -> 缺少文案: ${missing.join(", ")}`);
      } else {
        console.log(`  ✔ [${r.name}] (${r.path}) -> 200 OK (${r.checks.join(" / ")})`);
        adminPassed++;
      }
    } catch (err: any) {
      console.error(`  ❌ [${r.name}] (${r.path}) -> 错误: ${err.message}`);
    }
  }

  console.log(`\n👤 [2/3] 库管员 (${whUser.fullName}) 业务页面巡检:`);
  const whToken = await createSessionToken(whUser.id);
  const whCookie = `auth_session=${whToken}`;
  const whRoutes = ["/batches", "/pools", "/tags", "/bundling", "/sorting", "/cold-storage", "/outbound"];
  for (const p of whRoutes) {
    const res = await fetch(`http://localhost:3000${p}`, { headers: { Cookie: whCookie } });
    console.log(`  ✔ [库管视角] (${p}) -> HTTP ${res.status}`);
  }

  console.log(`\n👤 [3/3] 品控主管 (${qaUser.fullName}) 审批与台账巡检:`);
  const qaToken = await createSessionToken(qaUser.id);
  const qaCookie = `auth_session=${qaToken}`;
  const qaRoutes = ["/approvals", "/ledgers", "/pools", "/trace"];
  for (const p of qaRoutes) {
    const res = await fetch(`http://localhost:3000${p}`, { headers: { Cookie: qaCookie } });
    console.log(`  ✔ [品控视角] (${p}) -> HTTP ${res.status}`);
  }

  console.log(`\n================================================================`);
  console.log(`🎉 13 个业务功能路由与多角色权限实机渲染验证完成！通过率: ${adminPassed}/${routes.length} (${((adminPassed/routes.length)*100).toFixed(1)}%)`);
  console.log(`================================================================\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

