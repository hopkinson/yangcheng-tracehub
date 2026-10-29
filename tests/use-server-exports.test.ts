import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("🔍 启动 'use server' 模块导出合规静态扫描...");

// 背景：Next.js 规定 "use server" 文件只能导出异步函数。一旦导出 Set/Object 等
// 非函数值，生产环境所有 server action 会在运行时报
// "A 'use server' file can only export async functions, found object."
// （digest 形式脱敏），导致全站 server action 静默失效。详见 2026-10-29 事故。

const violations: Array<{ file: string; line: string }> = [];

function scanFile(fullPath: string) {
  const content = fs.readFileSync(fullPath, "utf-8");
  const trimmed = content.trim();
  const isUseServer = trimmed.startsWith('"use server"') || trimmed.startsWith("'use server'");
  if (!isUseServer) return;

  const relativePath = path.relative(process.cwd(), fullPath);
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    // 拦截值导出：export const/let/var（export type/interface 是编译期擦除的，合法）
    const valueExport = line.match(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (valueExport) {
      const name = valueExport[1];
      // export const foo = async function / export const foo = createXxx（异步函数引用）是合法的
      const rhs = line.slice(line.indexOf(name) + name.length).trim();
      const isAsyncFunctionValue =
        /^=\s*async\b/.test(rhs) ||
        /^=\s*(?:async\s+)?function\b/.test(rhs) ||
        /^=\s*create[A-Z]\w*\s*;?\s*$/.test(rhs);
      if (!isAsyncFunctionValue) {
        violations.push({ file: relativePath, line: line.trim().slice(0, 100) });
      }
      continue;
    }
    // 拦截重导出：export { x } / export * from（可能携带非函数值）
    if (/^export\s+\{/.test(line) || /^export\s+\*/.test(line)) {
      violations.push({ file: relativePath, line: line.trim().slice(0, 100) });
    }
  }
}

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      scanFile(fullPath);
    }
  }
}

const targetDir = path.join(process.cwd(), "src", "actions");
if (fs.existsSync(targetDir)) {
  scanDirectory(targetDir);
}

if (violations.length > 0) {
  console.error("\n❌ 检测到 'use server' 文件存在非法导出（只能是异步函数）：");
  violations.forEach((v) => {
    console.error(`  - [${v.file}] ${v.line}`);
  });
  console.error("\n👉 修复方法：把常量/对象移到 src/lib/ 下的普通模块再导入。\n");
  assert.fail(`共有 ${violations.length} 处 'use server' 非法导出，会导致全站 server action 失效！`);
} else {
  console.log("  ✔ 所有 'use server' 文件仅导出异步函数");
  console.log("🎉 'use server' 导出合规静态扫描 100% 通过！\n");
}
