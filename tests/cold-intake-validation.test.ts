import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";
import { createColdIntakeAction } from "../src/actions/production";
import prisma from "../src/lib/prisma";

async function testColdIntakeValidation() {
  console.log("▶ [Test Feedback Loop] 验证分拣批次选择与入库数量上限卡控...");

  // 1. 纯函数守恒校验
  if (typeof (Invariants as any).checkColdIntake !== "function") {
    throw new Error("Invariants.checkColdIntake 未定义，尚未实现分拣入库数量守恒卡控规则！");
  }

  const resOver = (Invariants as any).checkColdIntake({
    qualifiedCount: 438,
    alreadyIntakeCount: 0,
    intakeCount: 500,
    taskStatus: "COMPLETED",
  });
  assert.equal(resOver.valid, false, "申请 500 只超过分拣合格 438 只必须被拦截");
  console.log("  ✔ 纯函数超额拦截测试通过:", resOver.reason);

  // 2. Action 集成校验：使用已有分拣任务 FJR2026092101 (合格 438 只)
  const task = await prisma.sortTask.findFirst({
    where: { code: "FJR2026092101" },
  });
  const store = await prisma.coldStore.findFirst();

  if (!task || !store) {
    throw new Error("缺少测试所需的基础分拣任务或保鲜库数据");
  }

  // 尝试超额入库 999999 只
  const overActionRes = await createColdIntakeAction({
    storeId: store.id,
    count: 999999,
    refType: "SORT",
    refId: task.code,
    operator: "测试仓管",
  });

  assert.equal(
    overActionRes.success,
    false,
    `超额入库必须被拦截！实际却返回成功: ${JSON.stringify(overActionRes)}`
  );
  console.log("  ✔ Server Action 超额入库拦截生效:", overActionRes.message);

  // 3. 空批次拦截
  const emptyTaskRes = await createColdIntakeAction({
    storeId: store.id,
    count: 100,
    refId: "",
    operator: "测试仓管",
  });
  assert.equal(emptyTaskRes.success, false, "未选分拣批次必须被拦截");
  console.log("  ✔ 未选分拣批次拦截生效:", emptyTaskRes.message);

  // 4. 不存在的分拣批次拦截
  const fakeTaskRes = await createColdIntakeAction({
    storeId: store.id,
    count: 100,
    refId: "FJR_NON_EXISTENT_999",
    operator: "测试仓管",
  });
  assert.equal(fakeTaskRes.success, false, "不存在的分拣批次必须被拦截");
  console.log("  ✔ 不存在的分拣批次拦截生效:", fakeTaskRes.message);

  console.log("🎉 全部测试通过！");
}

testColdIntakeValidation()
  .catch((err) => {
    console.error("❌ 测试失败:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
