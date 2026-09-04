import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

async function testUploadsServing() {
  console.log("🧪 运行上传原件访问与路由处理测试 (tests/uploads-serving.test.ts)...\n");

  // 1. 验证目标路由文件是否存在
  const routePath = path.join(process.cwd(), "src", "app", "uploads", "[...path]", "route.ts");
  assert.ok(
    fs.existsSync(routePath),
    `❌ 缺少上传静态文件动态路由处理器: ${routePath}`
  );

  // 2. 动态导入路由处理器
  const { GET } = await import("../src/app/uploads/[...path]/route");
  assert.strictEqual(typeof GET, "function", "GET 路由处理器必须为函数");

  // 3. 创建测试上传文件
  const testUploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.promises.mkdir(testUploadDir, { recursive: true });
  const testFileName = `test_proof_${Date.now()}.png`;
  const testFilePath = path.join(testUploadDir, testFileName);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  await fs.promises.writeFile(testFilePath, pngHeader);

  try {
    // 4. 测试正常文件读取
    const req = new Request(`http://localhost:3000/uploads/${testFileName}`);
    const response = await GET(req, {
      params: Promise.resolve({ path: [testFileName] }),
    });

    assert.strictEqual(response.status, 200, "存在的文件应返回 200");
    assert.strictEqual(
      response.headers.get("content-type"),
      "image/png",
      "PNG 文件应返回正确的 Content-Type"
    );
    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    assert.deepStrictEqual(bodyBuffer, pngHeader, "返回的文件内容应与写入内容一致");
    console.log("  ✔ 正常文件读取与 Content-Type 响应成功 (200 OK)");

    // 5. 测试路径遍历攻击防护
    const attackReq = new Request("http://localhost:3000/uploads/../../package.json");
    const attackResponse = await GET(attackReq, {
      params: Promise.resolve({ path: ["..", "..", "package.json"] }),
    });
    assert.ok(
      attackResponse.status === 400 || attackResponse.status === 403 || attackResponse.status === 404,
      "路径穿越请求必须被拒绝 (400/403/404)"
    );
    console.log("  ✔ 路径穿越攻击安全防护生效 (已拦截非法访问)");

    // 6. 测试不存在的文件
    const notFoundReq = new Request("http://localhost:3000/uploads/non_existent_file_99999.jpg");
    const notFoundResponse = await GET(notFoundReq, {
      params: Promise.resolve({ path: ["non_existent_file_99999.jpg"] }),
    });
    assert.strictEqual(notFoundResponse.status, 404, "不存在的文件应返回 404");
    console.log("  ✔ 不存在文件安全返回 404 Not Found");

    console.log("\n🎉 上传原件访问与路由测试全部通过！");
  } finally {
    await fs.promises.unlink(testFilePath).catch(() => {});
  }
}

testUploadsServing().catch((err) => {
  console.error("\n❌ 测试失败:", err);
  process.exit(1);
});
