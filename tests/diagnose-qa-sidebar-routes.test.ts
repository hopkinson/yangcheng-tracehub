import assert from "node:assert/strict";
import { ROLE_ALLOWED_ROUTES, NAV_GROUPS } from "@/components/layout/AppShell";

async function testAllRoleSidebarRoutes() {
  console.log("🔍 [Phase 1 Loop] Testing WAREHOUSE_ADMIN, FARMER_ADMIN and QA_DIRECTOR allowed routes...\n");

  // 1. 验证 质检员 (QA_DIRECTOR)
  const qaRoutes = ROLE_ALLOWED_ROUTES["QA_DIRECTOR"] || [];
  const requiredQaRoutes = [
    "/orders", "/bundling", "/sorting", "/cold-storage",
    "/outbound", "/farmers", "/tags", "/stores"
  ];
  for (const href of requiredQaRoutes) {
    assert.ok(qaRoutes.includes(href), `质检员 (QA_DIRECTOR) 必须包含 ${href}`);
  }

  // 2. 验证 库管员 (WAREHOUSE_ADMIN)
  const whRoutes = ROLE_ALLOWED_ROUTES["WAREHOUSE_ADMIN"] || [];
  const requiredWhRoutes = [
    { href: "/farmers", label: "养殖档案", group: "档案与台账" },
    { href: "/reports", label: "检测报告", group: "档案与台账" },
  ];
  const missingWh: string[] = [];
  for (const item of requiredWhRoutes) {
    if (!whRoutes.includes(item.href)) {
      missingWh.push(`${item.label} (${item.href})`);
    }
  }
  if (missingWh.length > 0) {
    console.error("❌ 库管员 (WAREHOUSE_ADMIN) 缺失以下导航路由:", missingWh);
    assert.fail(`库管员缺少菜单项:\n${missingWh.join("\n")}`);
  }

  // 3. 验证 审核员 (FARMER_ADMIN)
  const faRoutes = ROLE_ALLOWED_ROUTES["FARMER_ADMIN"] || [];
  const requiredFaRoutes = [
    { href: "/orders", label: "订单管理", group: "订单" },
    { href: "/bundling", label: "捆扎管理", group: "生产与仓储" },
    { href: "/sorting", label: "分拣称重", group: "生产与仓储" },
    { href: "/cold-storage", label: "保鲜预冷", group: "生产与仓储" },
    { href: "/stores", label: "门店档案", group: "档案与台账" },
  ];
  const missingFa: string[] = [];
  for (const item of requiredFaRoutes) {
    if (!faRoutes.includes(item.href)) {
      missingFa.push(`${item.label} (${item.href})`);
    }
  }
  if (missingFa.length > 0) {
    console.error("❌ 审核员 (FARMER_ADMIN) 缺失以下导航路由:", missingFa);
    assert.fail(`审核员缺少菜单项:\n${missingFa.join("\n")}`);
  }

  // 4. 验证审核员与库管员的订单分组可见性
  const faVisibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => faRoutes.includes(item.href)),
  })).filter((group) => group.items.length > 0);

  const faOrderGroup = faVisibleGroups.find((g) => g.title === "订单");
  assert.ok(faOrderGroup, "整个'订单'分组在审核员视角下必须可见");
  assert.ok(
    faOrderGroup.items.some((i) => i.href === "/orders"),
    "订单分组中必须包含订单管理 (/orders)"
  );

  console.log("✅ 质检员、库管员、审核员所有指定功能菜单与分组完整校验通过！");
}

testAllRoleSidebarRoutes().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
