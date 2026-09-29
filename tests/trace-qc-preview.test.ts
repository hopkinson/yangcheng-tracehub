import assert from "node:assert/strict";
import { getPreviewFileUrl } from "../src/lib/utils";
import { NextRequest } from "next/server";
import { GET as previewGet } from "../src/app/api/files/preview/route";

async function testTraceQcPreview() {
  console.log("🧪 运行溯源品控附件在新标签页打开与统一预览测试 (tests/trace-qc-preview.test.ts)...\n");

  // 1. 验证 getPreviewFileUrl 在各种输入下的 URL 构造
  console.log("1. 测试 getPreviewFileUrl 构造逻辑:");
  assert.strictEqual(getPreviewFileUrl(null), "", "null 应返回空串");
  assert.strictEqual(getPreviewFileUrl(""), "", "空串应返回空串");

  // 当仅有 fileName (如用户截图中的 试吃05.pdf) 时，自动回退到 /uploads/ 并生成合法预览链接
  const previewOnlyFileName = getPreviewFileUrl(null, "试吃05.pdf");
  assert.ok(
    previewOnlyFileName.startsWith("/api/files/preview?"),
    "当仅提供 fileName 时，应回退并生成预览链接"
  );
  assert.ok(
    previewOnlyFileName.includes(encodeURIComponent("/uploads/试吃05.pdf")),
    "预览 URL 应包含有效的目标路径"
  );
  assert.ok(
    previewOnlyFileName.includes(encodeURIComponent("试吃05.pdf")),
    "预览 URL 应包含文件名参数"
  );
  console.log("  ✔ 仅凭证文件名时自动回退并构造安全预览链接成功");

  // 同时提供 fileUrl 与 fileName
  const previewBoth = getPreviewFileUrl("/uploads/custom_record.pdf", "品控抽检.pdf");
  assert.ok(previewBoth.includes("custom_record.pdf"));
  assert.ok(previewBoth.includes(encodeURIComponent("品控抽检.pdf")));
  console.log("  ✔ 完整参数时安全预览链接构造成功");

  // 2. 验证 /api/files/preview 对于 PDF 附件的 inline 响应
  console.log("\n2. 测试 /api/files/preview 对于 PDF 附件的在线预览响应:");
  const pdfReq = new NextRequest(
    `http://localhost:3000/api/files/preview?url=${encodeURIComponent("/uploads/试吃05.pdf")}&name=${encodeURIComponent("试吃05.pdf")}`
  );
  const pdfRes = await previewGet(pdfReq);
  assert.strictEqual(pdfRes.status, 200, "PDF 预览应返回 200");
  assert.strictEqual(
    pdfRes.headers.get("content-type"),
    "application/pdf",
    "PDF 应以 application/pdf 头部下发"
  );
  assert.ok(
    pdfRes.headers.get("content-disposition")?.includes("inline"),
    "PDF 响应必须包含 inline 确保浏览器直接在新标签页展示"
  );
  console.log("  ✔ PDF 附件在新标签页直接查看与 inline 响应测试通过");

  // 3. 验证 /api/files/preview 对于图片附件的 inline 响应
  console.log("\n3. 测试 /api/files/preview 对于图片附件的在线预览响应:");
  const imgReq = new NextRequest(
    `http://localhost:3000/api/files/preview?url=${encodeURIComponent("/uploads/BZ2026092101_包装巡检表.jpg")}&name=${encodeURIComponent("BZ2026092101_包装巡检表.jpg")}`
  );
  const imgRes = await previewGet(imgReq);
  assert.strictEqual(imgRes.status, 200, "图片附件预览应返回 200");
  assert.ok(
    imgRes.headers.get("content-disposition")?.includes("inline"),
    "图片响应必须包含 inline"
  );
  console.log("  ✔ 图片附件在线预览与 inline 响应测试通过");

  console.log("\n🎉 溯源品控附件在新标签页打开与在线预览测试全部通过！");
}

testTraceQcPreview().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
