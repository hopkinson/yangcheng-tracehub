import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { generateLedgerWorkbook } from "../src/lib/excel";

async function testExcelHyperlinkExport() {
  console.log("🧪 运行台账 Excel 导出超链接功能单元测试 (tests/excel-hyperlink-export.test.ts)...\n");

  const origin = "http://127.0.0.1:3000";
  const headers = [
    "记录日期", "记录时间", "记录编号", "记录类型", "表格编号", "质检人员", "结论", "异常原因", "附件", "记录人"
  ];
  const rows = [
    [
      "2026-09-28", "11:41", "SC2026092810", "2. 品质抽检与试吃记", "TEST-SC-003",
      "阳澄股份超级管理员", "合格", "—", "—", "阳澄股份超级管理员"
    ],
    [
      "2026-09-27", "22:25", "JC2026092705", "1. 药残及重金属快检", "TEST-JC-002",
      "阳澄股份超级管理员", "合格", "—", "/uploads/1790518915400_______-TEST.pdf", "阳澄股份超级管理员"
    ],
    [
      "2026-09-27", "22:28", "SC2026092706", "2. 品质抽检与试吃记", "TEST-SC-002",
      "阳澄股份超级管理员", "合格", "—", "https://oss.aliyun.com/crab/inspection-002.pdf", "阳澄股份超级管理员"
    ],
    [
      "2026-09-26", "09:00", "HT2026092601", "合同主档", "TEST-HT-001",
      "阳澄股份超级管理员", "有效", "—", "/uploads/contracts/farmer_contract.pdf", "阳澄股份超级管理员"
    ]
  ];

  const workbook = generateLedgerWorkbook({
    sheetName: "10 品控记录表",
    headers,
    rows,
    origin,
  });

  const ws = workbook.Sheets["10 品控记录表"];
  assert.ok(ws, "工作表 10 品控记录表 必须生成成功");

  // 1. 验证空附件（破折号）保持原样且无超链接
  const cellI2 = ws["I2"];
  assert.strictEqual(cellI2.v, "—", "空附件单元格应保留为破折号");
  assert.strictEqual(cellI2.l, undefined, "空附件单元格不应包含超链接");
  console.log("  ✔ 无附件单元格正常显示无超链接");

  // 2. 验证相对路径附件自动补全域名并生成可点击超链接 (I3 为第2行数据)
  const cellI3 = ws["I3"];
  const expectedUrlI3 = "http://127.0.0.1:3000/uploads/1790518915400_______-TEST.pdf";
  assert.strictEqual(cellI3.v, expectedUrlI3, "附件单元格应显示完整可访问 URL");
  assert.ok(cellI3.l, "附件单元格必须设置超链接属性 cell.l");
  assert.strictEqual(cellI3.l.Target, expectedUrlI3, "超链接目标地址应为补齐域名的完整 URL");
  console.log("  ✔ 相对路径附件已自动拼接域名且生成外部超链接");

  // 3. 验证绝对路径 (https://) 附件保留原 URL 且生成超链接 (I4 为第3行数据)
  const cellI4 = ws["I4"];
  const expectedUrlI4 = "https://oss.aliyun.com/crab/inspection-002.pdf";
  assert.strictEqual(cellI4.v, expectedUrlI4, "绝对路径附件单元格应保留原 URL");
  assert.ok(cellI4.l, "绝对路径附件单元格必须设置超链接属性 cell.l");
  assert.strictEqual(cellI4.l.Target, expectedUrlI4, "超链接目标地址应为原 URL");
  console.log("  ✔ 外部绝对 URL 附件超链接保留且有效");

  // 4. 验证合同附件等相对路径超链接生成 (I5 为第4行数据)
  const cellI5 = ws["I5"];
  const expectedUrlI5 = "http://127.0.0.1:3000/uploads/contracts/farmer_contract.pdf";
  assert.strictEqual(cellI5.v, expectedUrlI5, "相对路径附件应补齐为完整 URL");
  assert.ok(cellI5.l, "附件单元格必须设置超链接属性 cell.l");
  assert.strictEqual(cellI5.l.Target, expectedUrlI5, "超链接目标地址应为完整 URL");
  console.log("  ✔ 合同附件等相对路径附件超链接生成正确");

  // 5. 验证二进制序列化后读回，OpenXML 关系超链接依然完整
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const readWb = XLSX.read(buffer, { type: "buffer" });
  const readWs = readWb.Sheets["10 品控记录表"];

  assert.strictEqual(readWs["I3"].l?.Target, expectedUrlI3, "序列化写出并重新读取后超链接目标一致");
  assert.strictEqual(readWs["I4"].l?.Target, expectedUrlI4, "序列化写出并重新读取后绝对路径超链接一致");
  assert.strictEqual(readWs["I5"].l?.Target, expectedUrlI5, "序列化写出并重新读取后合同附件超链接一致");
  console.log("  ✔ OpenXML 二进制写出与重解析超链接保持 100% 完整与有效");

  console.log("\n🎉 全部台账 Excel 超链接导出测试通过！");
}

testExcelHyperlinkExport().catch((err) => {
  console.error("❌ 测试执行失败:", err);
  process.exit(1);
});
