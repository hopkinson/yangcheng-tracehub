import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("🔍 启动 Next.js App Router 客户端组件 ('use client') 静态合规扫描...");

const HOOKS_REGEX = /\b(useState|useEffect|useReducer|useCallback|useMemo|useRef|useLayoutEffect|useTransition|useDeferredValue|useForm|useFormContext|useWatch|usePathname|useSearchParams|useTheme)\b/;

const violations: Array<{ file: string; match: string }> = [];

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const match = content.match(HOOKS_REGEX);
      if (match) {
        const trimmed = content.trim();
        const hasUseClient = trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");
        if (!hasUseClient) {
          const relativePath = path.relative(process.cwd(), fullPath);
          violations.push({ file: relativePath, match: match[1] });
        }
      }
    }
  }
}

const targetSrc = path.join(process.cwd(), "src");
if (fs.existsSync(targetSrc)) {
  scanDirectory(targetSrc);
}

if (violations.length > 0) {
  console.error("\n❌ 检测到以下组件使用了 React 客户端 Hooks 但遗漏了 'use client' 声明：");
  violations.forEach((v) => {
    console.error(`  - [${v.file}] 检测到 Hook: ${v.match}`);
  });
  console.error("\n👉 修复方法：在上述文件顶部第一行添加 '\"use client\";'\n");
  assert.fail(`共有 ${violations.length} 个组件遗漏 'use client' 声明，已拦截避免生产构建报错！`);
} else {
  console.log("  ✔ 全项目所有包含客户端 Hooks 的组件均已正确标记 'use client'");
  console.log("🎉 客户端组件指令静态合规扫描 100% 通过！\n");
}
