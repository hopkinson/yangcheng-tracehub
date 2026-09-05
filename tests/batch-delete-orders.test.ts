import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { batchDeleteOrdersAction } from "../src/actions/production";

async function run() {
  console.log("🦀 启动待发货订单【全选批量删除】与守恒约束综合验证测试...\n");

  // 1. 测试空参数拦截
  console.log("▶ [Test 1] 空参数与未勾选防呆校验");
  const emptyRes = await batchDeleteOrdersAction([]);
  assert.equal(emptyRes.success, false);
  assert.equal(emptyRes.message, "请勾选要删除的待发货订单");
  console.log("  ✔ 空参数防呆拦截通过\n");

  // 2. 模拟用户报障场景：批量导入 14 笔订单（共 28 条规格需求明细）一键全选删除
  console.log("▶ [Test 2] 用户报障场景还原：28 条待发货订单明细一键【全选批量删除】");
  const batchImportId = `IM_SIM_${Date.now()}`;
  const targetDeliveryDate = new Date("2026-09-08T00:00:00Z");

  const createdOrderIds: string[] = [];
  for (let i = 1; i <= 14; i++) {
    const orderNo = `202609010${String(80 + i).padStart(2, "0")}`;
    // 母蟹 3.0两
    const female = await prisma.order.create({
      data: {
        code: `SO20260908${String(i * 2 - 1).padStart(3, "0")}_${Date.now()}`,
        importId: batchImportId,
        orderNo,
        type: "CRAB_CARD",
        storeName: "蟹卡提货",
        specModel: "8只装礼盒(3.0母蟹X4只, 4.0公蟹X4只)",
        gender: "FEMALE",
        weightTier: "3.0两",
        count: 4,
        deliveryDate: targetDeliveryDate,
        status: "PENDING",
      },
    });
    // 公蟹 4.0两
    const male = await prisma.order.create({
      data: {
        code: `SO20260908${String(i * 2).padStart(3, "0")}_${Date.now()}`,
        importId: batchImportId,
        orderNo,
        type: "CRAB_CARD",
        storeName: "蟹卡提货",
        specModel: "8只装礼盒(3.0母蟹X4只, 4.0公蟹X4只)",
        gender: "MALE",
        weightTier: "4.0两",
        count: 4,
        deliveryDate: targetDeliveryDate,
        status: "PENDING",
      },
    });
    createdOrderIds.push(female.id, male.id);
  }

  assert.equal(createdOrderIds.length, 28, "应成功生成 28 条待发货需求明细");

  // 触发全选批量删除
  const deleteBatchRes = await batchDeleteOrdersAction(createdOrderIds);
  assert.equal(deleteBatchRes.success, true);
  assert.equal(deleteBatchRes.message, "已成功删除 28 条待发货订单记录");

  // 验证数据库已彻底轧平清空
  const remainingInDb = await prisma.order.count({
    where: { id: { in: createdOrderIds } },
  });
  assert.equal(remainingInDb, 0, "数据库中 28 条已全部被删除，账面完全轧平");
  console.log("  ✔ 28 条待发货明细一键全选清空测试通过\n");

  // 3. 混合订单场景：包含已发货订单时，只能删除待发货，杜绝破坏已出库记录
  console.log("▶ [Test 3] 业务守恒防穿透：已发货订单 (SHIPPED) 绝对禁止被误删");
  const mixedImportId = `IM_MIX_${Date.now()}`;
  const pending1 = await prisma.order.create({
    data: {
      code: `SO_P1_${Date.now()}`,
      importId: mixedImportId,
      orderNo: "ORD_MIX_01",
      type: "STORE_ORDER",
      gender: "FEMALE",
      weightTier: "3.0两",
      count: 10,
      deliveryDate: targetDeliveryDate,
      status: "PENDING",
    },
  });

  const shipped1 = await prisma.order.create({
    data: {
      code: `SO_S1_${Date.now()}`,
      importId: mixedImportId,
      orderNo: "ORD_MIX_02",
      type: "STORE_ORDER",
      gender: "MALE",
      weightTier: "4.0两",
      count: 20,
      deliveryDate: targetDeliveryDate,
      status: "SHIPPED",
    },
  });

  // 勾选混合的 2 条记录
  const mixedRes = await batchDeleteOrdersAction([pending1.id, shipped1.id]);
  assert.equal(mixedRes.success, true);
  assert.equal(mixedRes.message, "已成功删除 1 条待发货订单记录");

  // 校验 pending1 已被删除，shipped1 依然安好
  const checkPending = await prisma.order.findUnique({ where: { id: pending1.id } });
  const checkShipped = await prisma.order.findUnique({ where: { id: shipped1.id } });
  assert.equal(checkPending, null, "PENDING 记录必须被删除");
  assert.ok(checkShipped !== null && checkShipped.status === "SHIPPED", "SHIPPED 记录必须完好无损");
  console.log("  ✔ 已发货订单防误删与守恒保护测试通过\n");

  // 清理测试数据
  await prisma.order.deleteMany({ where: { id: shipped1.id } });

  console.log("🎉 全部 3 项订单全选批量删除与业务硬约束测试 100% 通过！");
}

run()
  .catch((err) => {
    console.error("❌ 测试失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
