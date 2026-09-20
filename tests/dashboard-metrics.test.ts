import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("🔍 运行总览看板 8 大工序卡片指标契约测试...");

// 1. 静态分析 OverviewDashboard.tsx 确保渲染内容与结构符合用户要求
const overviewPath = path.resolve(__dirname, "../src/components/dashboard/OverviewDashboard.tsx");
const overviewSource = fs.readFileSync(overviewPath, "utf-8");

console.log("▶ [Test 1] 检查 OverviewDashboard.tsx 8 大卡片顶部主指标与副指标匹配");

// 卡片 1: 待发只数放上面，今日原始订单放下面
assert.match(
  overviewSource,
  /AnimatedNumber\s+value=\{metrics\.pendingDeliveryTotalCount\}[^>]*>\s*<\/AnimatedNumber>[\s\S]*?<span[^>]*>只(?:待发)?<\/span>|value=\{metrics\.pendingDeliveryTotalCount\}[\s\S]*?<span[^>]*>只(?:待发)?<\/span>/,
  "卡片1顶部必须是待发只数 (metrics.pendingDeliveryTotalCount)"
);
assert.match(
  overviewSource,
  /今日原始订单[：:][\s\S]*?metrics\.todayOrdersCount/,
  "卡片1副指标必须包含今日原始订单 (metrics.todayOrdersCount)"
);

// 卡片 2: 到货只数放上面，批次放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayInPoolTotalCount\}[\s\S]*?<span[^>]*>只(?:到货)?<\/span>/,
  "卡片2顶部必须是到货只数 (metrics.todayInPoolTotalCount)"
);
assert.match(
  overviewSource,
  /到货批次[：:][\s\S]*?metrics\.todayBatchesCount/,
  "卡片2副指标必须包含到货批次 (metrics.todayBatchesCount)"
);

// 卡片 3: 申领只数放上面，几批放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayTagClaimsTotalCount\}[\s\S]*?<span[^>]*>只(?:申领)?<\/span>/,
  "卡片3顶部必须是申领只数 (metrics.todayTagClaimsTotalCount)"
);
assert.match(
  overviewSource,
  /申领批次[：:][\s\S]*?metrics\.todayTagClaimsCount/,
  "卡片3副指标必须包含申领批次 (metrics.todayTagClaimsCount)"
);

// 卡片 4: 暂养入池数放上面，暂养损耗放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayPoolInCount\}[\s\S]*?<span[^>]*>只(?:入池)?<\/span>/,
  "卡片4顶部必须是暂养入池数 (metrics.todayPoolInCount)"
);
assert.match(
  overviewSource,
  /暂养损耗[：:][\s\S]*?metrics\.todayPoolLossCount/,
  "卡片4副指标必须包含暂养损耗 (metrics.todayPoolLossCount)"
);

// 卡片 5: 捆扎只数放上面，捆扎损耗放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayBundleTotalCount\}[\s\S]*?<span[^>]*>只<\/span>/,
  "卡片5顶部必须是捆扎只数 (metrics.todayBundleTotalCount)"
);
assert.match(
  overviewSource,
  /捆扎损耗[：:][\s\S]*?metrics\.todayBundleLossCount/,
  "卡片5副指标必须包含捆扎损耗 (metrics.todayBundleLossCount)"
);

// 卡片 6: 分拣只数放上面，分拣损耗放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todaySortQualifiedCount\}[\s\S]*?<span[^>]*>只(?:合格)?<\/span>/,
  "卡片6顶部必须是分拣只数 (metrics.todaySortQualifiedCount)"
);
assert.match(
  overviewSource,
  /分拣损耗[：:][\s\S]*?metrics\.todaySortLossCount/,
  "卡片6副指标必须包含分拣损耗 (metrics.todaySortLossCount)"
);

// 卡片 7: 保鲜入库数放上面，批次放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayColdIntakeCount\}[\s\S]*?<span[^>]*>只(?:入库)?<\/span>/,
  "卡片7顶部必须是保鲜入库只数 (metrics.todayColdIntakeCount)"
);
assert.match(
  overviewSource,
  /入库批次[：:][\s\S]*?metrics\.todayColdBatchesCount/,
  "卡片7副指标必须包含入库批次 (metrics.todayColdBatchesCount)"
);

// 卡片 8: 出库只数放上面，出库原始订单放下面
assert.match(
  overviewSource,
  /value=\{metrics\.todayOutboundTotalCount\}[\s\S]*?<span[^>]*>只<\/span>/,
  "卡片8顶部必须是出库只数 (metrics.todayOutboundTotalCount)"
);
assert.match(
  overviewSource,
  /出库(?:的)?原始订单[：:][\s\S]*?metrics\.todayOutboundOriginalOrdersCount/,
  "卡片8副指标必须包含出库原始订单 (metrics.todayOutboundOriginalOrdersCount)"
);

console.log("✔ [Test 1] OverviewDashboard.tsx 静态结构校验通过");

// 2. 检查 page.tsx 数据装配与指标透传
console.log("▶ [Test 2] 检查 page.tsx 传参是否完整包含新增指标");
const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf-8");

assert.match(pageSource, /todayPoolLossCount/, "page.tsx 必须计算并传递 todayPoolLossCount");
assert.match(pageSource, /todayBundleLossCount/, "page.tsx 必须计算并传递 todayBundleLossCount");
assert.match(pageSource, /todayColdBatchesCount/, "page.tsx 必须计算并传递 todayColdBatchesCount");
assert.match(pageSource, /todayOutboundOriginalOrdersCount/, "page.tsx 必须计算并传递 todayOutboundOriginalOrdersCount");

console.log("✔ [Test 2] page.tsx 数据计算与传递校验通过");
console.log("🎉 全部 8 大工序卡片指标契约测试 100% 通过！");
