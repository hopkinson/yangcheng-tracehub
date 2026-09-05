import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getPreviewFileUrl } from "../src/lib/storage";

async function testAttachmentPreview() {
  console.log("🧪 运行系统附件与报告预览全链路回归测试 (tests/attachment-preview.test.ts)...\n");

  // 1. 测试 getPreviewFileUrl 辅助函数
  console.log("1. 测试 getPreviewFileUrl 安全预览 URL 构造:");
  assert.strictEqual(getPreviewFileUrl(null), "", "null 应该返回空串");
  assert.strictEqual(getPreviewFileUrl(""), "", "空串应该返回空串");

  const dataUrl = "data:application/pdf;base64,JVBERi0xLjQK...";
  assert.strictEqual(getPreviewFileUrl(dataUrl), dataUrl, "DataURL 应该原样返回");

  const localUrl = "/uploads/20260921_contract.pdf";
  const previewLocal = getPreviewFileUrl(localUrl, "养殖合同.pdf");
  assert.ok(
    previewLocal.startsWith("/api/files/preview?"),
    "本地路径应转换为 /api/files/preview 代理以确保 inline 渲染"
  );
  assert.ok(previewLocal.includes(encodeURIComponent(localUrl)), "代理参数应包含原始 URL");
  console.log("  ✔ getPreviewFileUrl 转换正确");

  // 2. 测试默认种子报告文件存在性与 PDF 结构
  console.log("\n2. 测试系统预设检测报告物理文件:");
  const defaultReportPath = path.join(process.cwd(), "public", "uploads", "reports", "test-pesticide-report-2026.pdf");
  assert.ok(fs.existsSync(defaultReportPath), `预设报告文件必须存在: ${defaultReportPath}`);
  const reportContent = fs.readFileSync(defaultReportPath);
  assert.ok(reportContent.length > 500, "报告文件大小应大于 500 字节");
  assert.ok(
    reportContent.toString("utf-8").startsWith("%PDF-1.4"),
    "报告文件必须为合法的 PDF-1.4 格式"
  );
  console.log("  ✔ 预设检测报告文件存在且为合法 PDF");

  // 3. 测试 /uploads/[...path] 路由处理器响应头 (包含 Content-Disposition: inline)
  console.log("\n3. 测试 /uploads/[...path] 路由处理器的 inline 响应:");
  const { GET: uploadsGet } = await import("../src/app/uploads/[...path]/route");
  const testFileName = `test_proof_preview_${Date.now()}.pdf`;
  const testFilePath = path.join(process.cwd(), "public", "uploads", testFileName);
  fs.writeFileSync(testFilePath, reportContent);

  try {
    const uploadReq = new Request(`http://localhost:3000/uploads/${testFileName}`);
    const uploadRes = await uploadsGet(uploadReq, {
      params: Promise.resolve({ path: [testFileName] }),
    });

    assert.strictEqual(uploadRes.status, 200, "存在的上传文件应返回 200");
    assert.strictEqual(
      uploadRes.headers.get("content-type"),
      "application/pdf",
      "PDF 应返回 application/pdf"
    );
    assert.strictEqual(
      uploadRes.headers.get("content-disposition"),
      "inline",
      "必须包含 Content-Disposition: inline 确保浏览器预览而非强制下载"
    );
    console.log("  ✔ /uploads/... 正确下发 Content-Disposition: inline 头部");
  } finally {
    fs.unlinkSync(testFilePath);
  }

  // 4. 测试 /api/files/preview 代理接口
  console.log("\n4. 测试 /api/files/preview 统一预览与鉴权中转接口:");
  const { GET: previewGet } = await import("../src/app/api/files/preview/route");

  // 4.1 本地已存在文件读取
  const localPreviewReq = new NextRequest(
    `http://localhost:3000/api/files/preview?url=${encodeURIComponent("/uploads/reports/test-pesticide-report-2026.pdf")}&name=${encodeURIComponent("原料批次快检报告.pdf")}`
  );
  const localPreviewRes = await previewGet(localPreviewReq);
  assert.strictEqual(localPreviewRes.status, 200, "本地预设报告预览应返回 200");
  assert.strictEqual(
    localPreviewRes.headers.get("content-type"),
    "application/pdf",
    "预览接口应返回 application/pdf"
  );
  assert.ok(
    localPreviewRes.headers.get("content-disposition")?.includes("inline"),
    "预览接口必须包含 inline 声明"
  );
  console.log("  ✔ 本地报告文件通过预览接口成功代理并下发 inline 响应");

  // 4.2 缺失文件自动降级生成证书 PDF (杜绝 404 导致系统破损)
  const missingReportReq = new NextRequest(
    `http://localhost:3000/api/files/preview?url=${encodeURIComponent("/uploads/reports/missing-test-report.pdf")}&name=${encodeURIComponent("缺失历史报告.pdf")}`
  );
  const missingReportRes = await previewGet(missingReportReq);
  assert.strictEqual(missingReportRes.status, 200, "缺失的历史报告应自动降级生成证书，返回 200 而非 404");
  const fallbackBuf = Buffer.from(await missingReportRes.arrayBuffer());
  assert.ok(fallbackBuf.toString("utf-8").startsWith("%PDF-1.4"), "降级证书必须为有效 PDF");
  console.log("  ✔ 缺失历史报告自动降级生成有效 PDF 证书成功");

  // 4.3 路径穿越攻击拦截
  const traversalReq = new NextRequest(
    `http://localhost:3000/api/files/preview?url=${encodeURIComponent("/uploads/../../package.json")}`
  );
  const traversalRes = await previewGet(traversalReq);
  assert.strictEqual(traversalRes.status, 403, "非法路径穿越请求必须返回 403 Forbidden");
  console.log("  ✔ 预览接口路径穿越安全拦截成功 (403 Forbidden)");

  console.log("\n🎉 系统附件与报告预览全链路回归测试全部通过！");
}

testAttachmentPreview().catch((err) => {
  console.error("\n❌ 附件预览回归测试失败:", err);
  process.exit(1);
});
