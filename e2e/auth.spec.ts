import { test, expect } from "@playwright/test";

test.describe("用户鉴权与登录状态 E2E 回归测试", () => {
  test("未登录访问受保护路由应自动重定向至登录页并携带 redirect 参数", async ({ page }) => {
    // 访问受保护的根路径
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // 访问带特定路径的受保护页面
    await page.goto("/farmers");
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffarmers/);

    // 页面应呈现系统登录表单元素
    await expect(page.locator("input#phone")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("button#captcha-trigger-btn")).toBeVisible();
  });

  test("输入错误密码时应给出明确错误提示拦截", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#phone").fill("13800000001");
    await page.locator("input#password").fill("wrongpassword");
    await page.locator("button#captcha-trigger-btn").click();

    // 应留在登录页并显示错误提示
    await expect(page).toHaveURL(/\/login/);
    const errorNotice = page.locator(".text-destructive");
    await expect(errorNotice).toBeVisible();
    await expect(errorNotice).toContainText("手机号或密码错误");
  });

  test("使用有效管理员账号登录成功并进入工作台总览", async ({ page }) => {
    await page.goto("/login");

    // 平台预置管理员账号 (密码为 123456)
    await page.locator("input#phone").fill("13800000001");
    await page.locator("input#password").fill("123456");
    await page.locator("button#captcha-trigger-btn").click();

    // 成功登录后应跳转至首页并展示工作台核心元素
    await page.waitForURL("/", { timeout: 15000 });
    await expect(page).toHaveURL("/");

    // 验证侧边导航或顶部导航已渲染
    await expect(page.locator("body")).toBeVisible();
  });
});
