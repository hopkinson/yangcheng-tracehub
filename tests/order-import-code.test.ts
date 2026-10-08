import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Invariants, type RawImportOrder } from "../src/lib/invariants";

// Execute the real server action with isolated persistence and a fixed import day.
// Neither Next request context nor a business database is needed for this regression.
const source = readFileSync("src/actions/production.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const codes = new Set(Array.from({ length: 1000 }, (_, i) => `SO20261008${String(i + 1).padStart(3, "0")}`));
const saved: Array<RawImportOrder & { code: string; storeId: string; deliveryDate: Date }> = [];
const prisma = {
  store: { findMany: async () => [{ id: "store-6587", code: "6587", name: "上海浦东东山姆" }] },
  order: {
    findFirst: async () => ({ code: [...codes].sort().at(-1) }),
    findMany: async () => [...saved],
    createMany: async ({ data }: { data: typeof saved }) => {
      for (const row of data) {
        assert.ok(!codes.has(row.code), `Unique constraint failed on code: ${row.code}`);
        codes.add(row.code);
      }
      saved.push(...data);
      return { count: data.length };
    },
  },
};
const modules: Record<string, unknown> = {
  "node:crypto": { randomUUID },
  "next/cache": { revalidatePath() {} },
  "@prisma/client": {},
  "@/lib/prisma": { default: prisma, __esModule: true },
  "@/lib/invariants": { Invariants },
  "@/lib/auth": { requireRole: async () => {} },
  "@/lib/holding-pool": {},
  "@/actions/daily-close": {},
  "@/lib/utils": { getBeijingDateStr: () => "20261008" },
};
const exports: { importOrdersAction?: (rows: RawImportOrder[]) => Promise<{ success: boolean; message: string }> } = {};
runInNewContext(compiled, {
  exports,
  console: { error() {} },
  require(name: string) {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  },
});
const importOrders = exports.importOrdersAction!;
const order = (orderNo: string): RawImportOrder => ({
  orderNo, type: "STORE_ORDER", storeCode: "6587", storeName: "上海浦东东山姆",
  gender: "FEMALE", weightTier: "2.5两", count: 40, deliveryDate: "2026-10-08",
});

async function main() {
  const first = await importOrders([order("X0001")]);
  assert.equal(first.success, true, first.message);
  assert.equal(saved[0].orderNo, "X0001", "Original Excel order number must be preserved");
  assert.match(saved[0].code, /^SO20261008-[0-9a-f-]{36}$/);

  const results = await Promise.all([
    importOrders([order("X0002")]),
    importOrders([order("X0003")]),
  ]);
  for (const result of results) assert.equal(result.success, true, result.message);
  assert.equal(new Set(saved.map(row => row.code)).size, 3);

  const duplicate = await importOrders([order("X0001")]);
  assert.equal(duplicate.success, false);
  assert.match(duplicate.message, /已导入，请勿重复上传/);
  assert.equal(saved.length, 3, "Duplicate upload must not write additional rows");
  console.log("PASS: imports after 1000 rows, concurrent distinct orders, and duplicate upload protection");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
