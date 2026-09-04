import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("🔍 验证原料批次到货入池登记 (MultiSpecIntakeDialog) 多规格明细行表头完整性...");

const filePath = path.join(process.cwd(), "src/components/batches/MultiSpecIntakeDialog.tsx");
assert.ok(fs.existsSync(filePath), `文件不存在: ${filePath}`);

const content = fs.readFileSync(filePath, "utf-8");

// 校验明细编辑区域内是否存在表头定义
const headerSectionRegex = /<Label[^>]*>码单多规格明细行[\s\S]*?<\/div>([\s\S]*?){\s*items\.map/;
const match = content.match(headerSectionRegex);

assert.ok(match, "❌ 未能找到 '码单多规格明细行' 与 'items.map' 之间的区域");

const headerSection = match[1];

// 检查是否包含表头列定义
const expectedColumns = [
  { name: "公母/性别", regex: /(性别|公母)/ },
  { name: "规格档位", regex: /(规格|规格档位|重量规格)/ },
  { name: "重量(斤)", regex: /重量\s*(\(|（)斤(\)|）)/ },
  { name: "入池数量(只)", regex: /入池(数量|只数)\s*(\(|（)?只?(\)|）)?/ },
  { name: "分配暂养池", regex: /(分配暂养池|入暂养池|目标暂养池)/ },
  { name: "操作", regex: /操作/ },
];

const missingColumns: string[] = [];
for (const col of expectedColumns) {
  if (!col.regex.test(headerSection)) {
    missingColumns.push(col.name);
  }
}

if (missingColumns.length > 0) {
  console.error(`❌ MultiSpecIntakeDialog 缺少以下表头列: ${missingColumns.join(", ")}`);
  assert.fail(`多规格明细行缺少表头列: ${missingColumns.join(", ")}`);
}

console.log("✔ 表头所有列完整无缺 (公母性别、重量规格、重量(斤)、入池数量(只)、分配暂养池、操作)");
console.log("🎉 验证通过！");
