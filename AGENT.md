# 阳澄股份大闸蟹全链路溯源品控管理系统 —— 开发者与 AI Agent 核心开发规范手册 (AGENT.md)

> **版本**：V1.3  
> **工程名称**：yangcheng-tracehub  
> **适用对象**：AI 编程助手、全栈开发工程师、品控架构师  

---

## 1. 系统核心定位与业务世界观 (Domain Core)

### 1.1 业务本质
本系统**不是防伪防串货系统**，而是一套**数量闭环管控与供应链合规证明系统**。
- **不追踪单只蟹**：蟹扣为养殖户码（一户一码），不含批次号、无唯一序列号、不扫码。
- **核心业务价值**：通过对 **“额度核定、原料入池、蟹扣领用、出库发运”** 四大数量节点的层层校验与逐日轧平对账，以严密的数字化台账证明：**“公司向市场/渠道发出的带扣蟹总量，严格小于等于签约养殖户的理论产量”**。
- **外部审核支撑**：为山姆会员店（Sam's Club）等大型商超渠道的供应商审核提供批次级反向追溯链条与四本合规台账。

---

## 2. 五大数量守恒定律（系统硬约束，严禁违背）

```mermaid
graph LR
    A[养殖户核定额度<br/>面积 × 600只/亩] -->|≤ 额度| B[原料批次入池<br/>一批一公母一规格]
    B -->|≤ 在池存活| C[蟹扣领用申请<br/>动态计算可领余量]
    C -->|出库打包绑扣| D[出库单发运<br/>单票核对 + 在池校验]
    D -->|逐日轧平对账| E[日结闭环<br/>领扣 = 绑扣 + 退回 + 作废]
```

1. **源头额度卡控**：$\sum \text{Batch.inPoolCount}_{\text{year}} \le \text{Farmer.area} \times 600$。超额直接拦截，确需放行必须 `ADMIN` 特批留痕。
2. **蟹扣领用余量**：$\text{TagClaim.count} \le \min\left(\text{Farmer.activeInPoolTotal}, \text{Farmer.remainingQuota}\right)$。
3. **批次在池存活**：$\text{BookInPool} = \text{inPoolCount} - \text{outPoolCount} - \text{lossCount}$。出库数量严禁大于此值。
4. **单票出库核对**：$\text{OutboundCount} = \text{ChannelOrderCount}$（出库数量严格等于渠道订单数量）。
5. **蟹扣日清日结轧平**：$\text{当日领扣数} = \text{当日绑扣出库数} + \text{当日退回数} + \text{当日作废数}$（必须逐日轧平）。

### 核心不等式链：
$$\text{累计出库数} \le \text{累计已核销蟹扣数} \le \text{累计领扣数} \le \text{累计入池数} \le \text{年度核定总额度}$$

---

## 3. 技术栈选型规范 (Tech Stack Blueprint)

| 层次 / 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **全栈框架** | **Next.js 15 (App Router + React 19)** | Server Actions 强类型调用，RSC 极致首屏体验与 SSR 报表导出 |
| **开发语言** | **TypeScript 5.x (Strict)** | 全链路类型安全，前后端共享 Zod 校验 Schema |
| **数据库 & ORM** | **PostgreSQL + Prisma ORM 6.x** | 行级锁（`SELECT FOR UPDATE`）与 ACID 强事务，保障高并发数量守恒 |
| **UI 规范** | **shadcn/ui (New York / Nova Style)** | **严格遵循 shadcn/ui 组件规范与最佳实践** |
| **样式体系** | **Tailwind CSS v4** | 严格使用语义化主题 Token（`bg-primary`, `text-muted-foreground` 等） |
| **图标体系** | **lucide-react** | 遵循 shadcn/ui 标准属性（`data-icon`） |
| **表单与校验** | **React Hook Form + Zod** | 实时联动校验（如面积自动算额度、实盘差额算损耗） |
| **高级台账表格** | **TanStack Table v8 + nuqs** | 四大合规台账按日筛选、列排序、URL 状态同步与 Excel 导出 |
| **数据可视化** | **shadcn/ui Charts (Recharts)** | 数量闭环看板、额度消耗进度、损耗趋势分析 |
| **消息反馈** | **Sonner (shadcn/ui Toast)** | 操作反馈与品控拦截告警 |

---

## 4. 严格遵守 shadcn/ui UI 开发规范 (Mandatory UI Rules)

所有前端界面的开发必须**无条件遵守 shadcn/ui 官方规范**，严禁使用非规范的自定义样式或手写拼凑组件：

### 4.1 表单规范 (Forms & Inputs)
- ❌ **严禁**使用裸 `div + space-y-*` 或 `grid gap-*` 搭配裸 `label`。
- ✅ **必须**使用 `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription` + `FieldError` 标准表单结构。
- ✅ 表单校验状态必须正确传递：在 `Field` 上设置 `data-invalid`，在输入控件上设置 `aria-invalid`。
- ✅ 2~5 项的选择切换必须使用 `ToggleGroup` + `ToggleGroupItem`，严禁循环 `Button` 手写 active 状态。
- ✅ 输入框组合按钮必须使用 `InputGroup` + `InputGroupInput` + `InputGroupAddon`。

### 4.2 布局与间距规范 (Layout & Spacing)
- ❌ **严禁**使用 `space-x-*` 或 `space-y-*`。
- ✅ **必须**使用 `flex flex-col gap-*` 或 `grid gap-*`。
- ✅ 等宽高元素严格使用 `size-*`（如 `size-10`），禁止 `w-10 h-10`。
- ✅ 溢出文本严格使用 `truncate`，禁止手动编写多类名。

### 4.3 颜色与无障碍规范 (Colors & Accessibility)
- ❌ **严禁**手写 `dark:` 颜色覆盖或硬编码 Tailwind 原始色（如 `text-blue-600`、`bg-green-500`）。
- ✅ **必须**使用语义化设计令牌：`bg-background`、`text-foreground`、`bg-primary`、`text-muted-foreground`、`text-destructive`。
- ✅ 状态标签必须使用 `Badge` 及其对应 variant（`default`, `secondary`, `destructive`, `outline`）。
- ✅ `Dialog`、`Sheet`、`Drawer` 必须包含 `DialogTitle`、`SheetTitle`、`DrawerTitle`，若视觉隐藏需添加 `className="sr-only"`。
- ✅ `Card` 必须完整使用 `CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`CardFooter` 组合。
- ✅ `Button` 内的图标必须声明 `data-icon="inline-start"` 或 `data-icon="inline-end"`，禁止在图标上写额外尺寸类名。

---

## 5. 核心业务规则与状态机 (Business Rules)

### 5.1 暂养池规格复用规则
- 暂养池（`HoldingPool`）作为厂内物理仓位，支持**按规格复用**。
- 池子标记当前在养规格（`currentGender` + `currentWeightTier`）。
- **同规格**（公母一致且重量档位一致）的原料批次可以继续入池；**不同公母或不同规格档位绝对禁止混池**。
- 批次创建时绑定暂养池，暂养期间原则上不换池。当池内所有批次存活清零时，池子恢复为空闲待命状态。

### 5.2 损耗管理（盘点登记制）
- 损耗不是系统估算，而是现场实盘点数登记产生。
- **公式**：$\text{本次损耗} = \text{账面在池} - \text{实盘数量}$。
- **拦截**：实盘 > 账面在池时，**禁止登记负损耗**，先核查出入库与盘点误差。
- **品控告警**：累计损耗率超过 $5\%$ 时，系统强制要求填写损耗原因，自动标记异常并抄送品控主管。

### 5.3 渠道追溯（批次级全链路）
- 渠道人员（如山姆）登录系统后，只可查看发往本渠道门店的数据。
- 追溯链条：`出库单 (CK) -> 原料批次 (PC) -> 暂养池 (ZY) -> 养殖户 (JD) -> 围网 (W) -> 出库日期 -> 门店 (ST)`。
- 系统自动出具符合商超标准的合规追溯单与数量闭环证明。

---

## 6. 项目标准目录结构 (Project Layout)

```
yangcheng-tracehub/
├── docs/                        # 需求分析与系统设计文档
│   ├── PRD_ANALYSIS.md          # 需求剖析与业务逻辑
│   ├── TECHNICAL_SELECTION.md   # 技术选型与架构规范
│   ├── DATA_MODEL.md            # 数据模型与 ER 设计
│   └── BUSINESS_RULES.md        # 5大数量守恒与卡控算法
├── prisma/                      # 数据库建模与迁移
│   ├── schema.prisma            # Prisma Schema 核心模型
│   └── seed.ts                  # 种子数据初始化
├── src/
│   ├── app/                     # Next.js 15 App Router
│   │   ├── (auth)/login/        # 登录与角色切换
│   │   ├── (dashboard)/         # 管理系统核心模块
│   │   │   ├── layout.tsx       # 响应式 Sidebar + Header 布局
│   │   │   ├── page.tsx         # 数量闭环总看板 (Dashboard)
│   │   │   ├── farmers/         # 养殖户管理与额度核定
│   │   │   ├── batches/         # 原料批次 (入池登记与盘点损耗)
│   │   │   ├── pools/           # 暂养池监控与在养规格锁定
│   │   │   ├── tags/            # 蟹扣领用、核销与日结轧平
│   │   │   ├── outbound/        # 出库管理、绑扣打包与物流回填
│   │   │   ├── approvals/       # 品控审批中心 (领扣/出库/异常处理)
│   │   │   ├── ledgers/         # 四大合规台账 (按日查询与导出)
│   │   │   ├── trace/           # 渠道反向追溯查询 (渠道数据隔离)
│   │   │   └── settings/        # 门店档案与系统配置
│   ├── components/              # 严格遵守 shadcn/ui 规范的组件
│   │   ├── ui/                  # shadcn/ui 原子组件
│   │   ├── forms/               # 业务表单 (带 Zod 校验)
│   │   ├── ledgers/             # 台账表格 (TanStack Table)
│   │   ├── trace/               # 追溯全链路时间线与拓扑卡片
│   │   └── charts/              # 数量平衡漏斗图与状态看板
│   ├── lib/                     # 工具库与业务校验引擎
│   │   ├── prisma.ts            # Prisma 单例
│   │   ├── invariants/          # 5大数量守恒校验引擎
│   │   ├── validations/         # Zod 业务表单校验 Schema
│   │   ├── auth.ts              # 鉴权与 Session 获取
│   │   └── utils.ts             # cn() 等通用方法
│   ├── actions/                 # Server Actions (事务级强一致性业务操作)
│   └── types/                   # TypeScript 类型定义
├── AGENT.md                     # 本开发指南
├── package.json
└── tsconfig.json
```

---

## 7. 开发路线与下一步建议 (Next Steps)

1. **项目工程脚手架初始化**：
   - 运行 Next.js 15 + Tailwind CSS v4 + TypeScript 初始化。
   - 初始化 `components.json` (shadcn/ui) 并按需安装核心 UI 组件（`button`, `card`, `dialog`, `table`, `badge`, `sheet`, `tabs`, `sonner`, `chart`, `form` 等）。
2. **数据库与 Prisma 部署**：
   - 生成 `prisma/schema.prisma` 并运行 `prisma db push` / `prisma migrate`。
   - 编写 `prisma/seed.ts` 生成真实仿真数据（养殖户、围网、暂养池、门店、初始批次）。
3. **核心校验引擎与 Server Actions 编写**：
   - 实现 `src/lib/invariants/` 数量守恒校验器。
   - 编写事务级 Server Actions（批次入池、蟹扣领用、出库审批、盘点损耗、日结轧平）。
4. **前端交互与四大台账开发**：
   - 严格按照 shadcn/ui 规范搭建高颜值、易操作的企业级管理界面与渠道追溯看板。
