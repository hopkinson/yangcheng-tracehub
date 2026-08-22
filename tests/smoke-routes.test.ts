import assert from "node:assert/strict";

async function smokeTestRoutes() {
  console.log("🌐 正在检测 Next.js Web 服务的页面路由连通性与渲染健康状态...\n");

  const baseUrl = "http://127.0.0.1:3000";
  const routes = [
    { path: "/login", name: "用户登录页", expectedStatus: 200 },
    { path: "/", name: "系统总览工作台", expectedStatus: [200, 307, 308] },
    { path: "/farmers", name: "养殖户管理与额度台账", expectedStatus: [200, 307, 308] },
    { path: "/batches", name: "原料批次与监测报告", expectedStatus: [200, 307, 308] },
    { path: "/pools", name: "暂养池规格复用监控", expectedStatus: [200, 307, 308] },
    { path: "/tags", name: "蟹扣领用与日清日结", expectedStatus: [200, 307, 308] },
    { path: "/outbound", name: "出库管理与物流回填", expectedStatus: [200, 307, 308] },
    { path: "/approvals", name: "品控审批中心", expectedStatus: [200, 307, 308] },
    { path: "/ledgers", name: "四本台账综合查询", expectedStatus: [200, 307, 308] },
    { path: "/trace", name: "山姆渠道反向溯源", expectedStatus: [200, 307, 308] },
    { path: "/stores", name: "渠道与门店档案配置", expectedStatus: [200, 307, 308] },
    { path: "/users", name: "系统角色与权限配置", expectedStatus: [200, 307, 308] },
  ];

  let passed = 0;

  for (const r of routes) {
    try {
      const res = await fetch(`${baseUrl}${r.path}`, {
        redirect: "manual",
      });
      const allowed = Array.isArray(r.expectedStatus) ? r.expectedStatus : [r.expectedStatus];
      
      if (allowed.includes(res.status)) {
        console.log(`  ✔ [HTTP ${res.status}] ${r.name.padEnd(20, " ")} (${r.path}) 响应正常`);
        passed++;
      } else {
        console.warn(`  ⚠ [HTTP ${res.status}] ${r.name} (${r.path}) 返回异常状态码`);
      }
    } catch (err: any) {
      console.error(`  ❌ 无法连接到 ${r.path}: ${err.message}`);
    }
  }

  console.log(`\n🎉 页面路由连通性冒烟测试完成：成功验证 ${passed} / ${routes.length} 个功能路由！`);
}

smokeTestRoutes();
