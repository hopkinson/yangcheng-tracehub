import { test, expect } from "@playwright/test";

test.describe("系统核心模块导航与页面渲染 E2E 回归测试", () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统管理员账号
    await page.goto("/login");
    await page.locator("input#phone").fill("13800000001");
    await page.locator("input#password").fill("123456");
    await page.locator("button#captcha-trigger-btn").click();
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("养殖档案页面 (/farmers) 连通与渲染", async ({ page }) => {
    await page.goto("/farmers");
    await expect(page).toHaveURL("/farmers");
    await expect(page.locator("main")).toBeVisible();
  });

  test("原料批次页面 (/batches) 连通与渲染", async ({ page }) => {
    await page.goto("/batches");
    await expect(page).toHaveURL("/batches");
    await expect(page.locator("main")).toBeVisible();
  });

  test("暂养监控页面 (/pools) 连通与渲染", async ({ page }) => {
    await page.goto("/pools");
    await expect(page).toHaveURL("/pools");
    await expect(page.locator("main")).toBeVisible();
  });

  test("蟹扣管理页面 (/tags) 连通与渲染", async ({ page }) => {
    await page.goto("/tags");
    await expect(page).toHaveURL("/tags");
    await expect(page.locator("main")).toBeVisible();
  });

  test("出库管理页面 (/outbound) 连通与渲染", async ({ page }) => {
    await page.goto("/outbound");
    await expect(page).toHaveURL("/outbound");
    await expect(page.locator("main")).toBeVisible();
  });

  test("审批中心页面 (/approvals) 连通与渲染", async ({ page }) => {
    await page.goto("/approvals");
    await expect(page).toHaveURL("/approvals");
    await expect(page.locator("main")).toBeVisible();
  });
});
