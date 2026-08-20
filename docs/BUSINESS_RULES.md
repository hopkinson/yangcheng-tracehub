# 阳澄股份大闸蟹全链路溯源品控管理系统 —— 业务卡控与对账闭环算法规范

## 1. 核心数量闭环卡控逻辑 (Hard Invariants)

系统在所有关键业务节点实施数据库事务级强校验（Pessimistic/Optimistic Check），绝不允许超额、混池、超发或漏结。

---

### 卡口 1：养殖户年度额度与批次创建（入池登记）
- **触发时机**：仓库管理员提交《原料批次创建（入池登记）》。
- **校验逻辑**：
  $$\sum \text{Batch.inPoolCount}_{\text{year}} + \text{本次入池数量} \le \text{Farmer.quota}$$
- **判定规则**：
  1. 养殖户合作状态必须为 `ACTIVE`，否则直接拦截。
  2. 若累计入池数量超过额度，系统**直接拦截报错**。
  3. **特批分支**：如确因养殖丰产需要接收，必须由 `ADMIN`（超级管理员）发起特批，填写审批原因并写入 `SpecialApproval` 表留痕后，方可强制录入。
- **暂养池在养规格校验**：
  1. 查询所选暂养池的当前在养状态。
  2. 若池中已有在养活蟹（存活数 > 0），则本批次的 `Gender` 与 `WeightTier` 必须与池子标记的在养规格完全一致。
  3. 若规格不符，系统禁用该暂养池选择，杜绝混池。
  4. 若池子当前为空（存活数 = 0），则本批次入池后自动将池子的在养规格更新为本批次规格。

---

### 卡口 2：蟹扣领用余量动态计算与申请校验
- **触发时机**：仓库管理员发起蟹扣领用申请。
- **界面与服务端可领余量计算公式**：
  $$\text{Farmer.activeInPoolTotal} = \sum_{\text{batches}} (\text{inPoolCount} - \text{outPoolCount} - \text{lossCount})$$
  $$\text{Farmer.remainingQuota} = \text{Farmer.quota} - \sum_{\text{year}} \text{Batch.inPoolCount}$$
  $$\text{MaxClaimable} = \min\left(\text{Farmer.activeInPoolTotal}, \text{Farmer.quota} - \sum_{\text{year}} \text{TagClaim.boundCount}\right)$$
- **校验规则**：
  1. 领扣数量 $\le \text{MaxClaimable}$。
  2. 当日领用的蟹扣必须当日完成绑扣出库，未用完的当日退回或登记作废，严禁跨日滞留。

---

### 卡口 3：盘点损耗登记（实盘制）与品控 5% 拦截
- **触发时机**：仓库盘点人员登记实盘数量。
- **计算逻辑**：
  $$\text{BookInPool} = \text{Batch.inPoolCount} - \text{Batch.outPoolCount} - \text{Batch.lossCount}$$
  $$\text{LossDelta} = \text{BookInPool} - \text{PhysicalCount}$$
- **异常拦截**：
  1. 若 $\text{PhysicalCount} > \text{BookInPool}$（实盘多于账面），**严禁登记为负损耗**，系统提示：“实盘数量大于账面在池，请先排查出入库与盘点记录”。
  2. 若 $\text{LossRate} = \frac{\text{Batch.lossCount} + \text{LossDelta}}{\text{Batch.inPoolCount}} > 5\%$：
     - 系统自动将该批次标记为 `isException = true`。
     - 表单强制要求填写 `reason`（损耗原因）。
     - 系统自动给品控主管发送高危告警。

---

### 卡口 4：出库审批与三方一致性校验
- **触发时机**：品控主管审核出库单。
- **校验规则（三方一致）**：
  1. **在池存活校验**：$\text{OutboundCount} \le \text{Batch.BookInPool}$。超发出库直接拒绝审批。
  2. **单票核对**：$\text{OutboundCount} = \text{ChannelOrderCount}$（出库数量必须等于渠道订单数量）。
  3. **出库完成状态变更**：
     - 扣减批次在池数量：`Batch.outPoolCount += OutboundCount`。
     - 若 `Batch.BookInPool == 0`，批次状态自动变更为 `COMPLETED`。若暂养池所有批次在池数清零，释放池子规格锁定。

---

### 卡口 5：蟹扣日清日结与逐日轧平机制
- **触发时机**：每日运营结束时，仓库管理员与品控主管执行日结对账。
- **按养殖户轧平公式**：
  $$\text{当日领扣数} = \text{当日绑扣出库数} + \text{当日退回数} + \text{当日作废数}$$
- **对账规则**：
  1. 若等式两边完全相等，该养殖户当日台账标记为 `isBalanced = true`（已轧平），允许结单。
  2. 若出现不平衡差额，系统**阻止结单并标红告警**，必须录入退回数量（附原因）或作废数量（附原因）直至完全轧平。

---

## 2. 渠道反向追溯查询机制

面向渠道人员（如山姆会员店采购与品控代表）开放：

```
[渠道出库单] (CK-20260901-001)
     │
     ▼
[原料批次] (PC-20260901-001, 公蟹 4.0两, 入池时间: 2026-09-01 08:30)
     │
     ├───────────────┬───────────────┐
     ▼               ▼               ▼
[暂养池] (ZY-01)   [养殖户] (JD-2026-001) [围网水域] (W-01)
                     │
                     ▼
            [核定额度合规证明] (面积 100亩 -> 额度 60,000只, 当年累计出库 12,400只 <= 额度)
```

**数据安全与隔离原则**：
- 渠道账号只能查看收货门店隶属于本渠道的出库单溯源链路。
- 系统自动出具符合山姆审核标准的《大闸蟹合规溯源与数量平衡证明单》。
