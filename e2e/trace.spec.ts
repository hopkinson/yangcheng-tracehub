import { test, expect } from "@playwright/test";

test.describe("反向穿透溯源查询 E2E 回归测试", () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理员账号
    await page.goto("/login");
    await page.locator("input#phone").fill("13800000001");
    await page.locator("input#password").fill("123456");
    await page.locator("button#captcha-trigger-btn").click();
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("溯源初始态渲染与非空搜索校验", async ({ page }) => {
    await page.goto("/trace");

    // 验证搜索框和页面标题正常呈现
    await expect(page.locator("h2")).toContainText("全链路溯源查询");
    const searchInput = page.locator('input[placeholder*="支持输入订单号"]');
    await expect(searchInput).toBeVisible();

    // 搜索不存在的单号，校验未命中提示
    await searchInput.fill("UNKNOWN-ORDER-999999");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/query=UNKNOWN-ORDER-999999/);
    await expect(page.locator("h3")).toContainText("未检索到溯源档案");
  });
});
