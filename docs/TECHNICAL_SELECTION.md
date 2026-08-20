# 阳澄股份大闸蟹全链路溯源品控管理系统 —— 技术选型与架构设计方案

## 1. 技术选型概览

本系统面向企业级供应链管理与大型商超（山姆等）审计，对**事务一致性、数据防篡改、UI交互规范性、台账检索性能**有极高要求。选型严格按照用户要求：**React 19 + Prisma + shadcn/ui** 全栈体系。

| 层次 / 领域 | 选型方案 | 选型理由与技术收益 |
| :--- | :--- | :--- |
| **全栈框架** | **Next.js 15 (App Router + React 19)** | Server Actions 提供强类型 RPC 调用；服务端组件 (RSC) 极致首屏渲染，天然支持多角色鉴权与 SSR 报表导出 |
| **开发语言** | **TypeScript 5.x (Strict Mode)** | 端到端类型安全，共享 Zod Schema，避免数量计算与状态机运行时类型错误 |
| **数据库 & ORM** | **PostgreSQL + Prisma ORM 6.x** | PostgreSQL 提供强大的行级锁（`SELECT FOR UPDATE`）与 ACID 强事务，保证高并发入池与出库时不发生超卖/超额；Prisma 提供极致开发体验与类型提示 |
| **UI 组件库** | **shadcn/ui (New York / Nova Style)** | **严格遵循 shadcn/ui 官方组件规范**：无运行时样式开销，无侵入式可控源码，支持无障碍无缝访问（Radix UI 底层） |
| **样式体系** | **Tailwind CSS v4** | 基于 CSS 变量的语义化设计令牌（`bg-primary`、`text-muted-foreground`），内置深浅色主题适配 |
| **图标库** | **lucide-react** | 符合 shadcn/ui 规范，严格使用 `data-icon` 属性与标准尺寸控制 |
| **表单与校验** | **React Hook Form + Zod + FormField** | 客户端即时联动校验（如输入面积实时计算额度）+ 服务端 Server Actions 双重校验 |
| **高级数据表格** | **TanStack Table v8 + nuqs** | 四大合规台账的按日筛选、列排序、条件过滤与 URL 状态持久化（URL SearchParams 同步） |
| **可视化图表** | **shadcn/ui Charts (基于 Recharts)** | 额度使用率环形图、在池存活与损耗趋势图、四大数量流转漏斗图 |
| **消息通知** | **Sonner (shadcn/ui Toast)** | 优雅的操作反馈与品控拦截告警通知 |
| **鉴权与 RBAC** | **NextAuth.js v5 / JWT Session + Middleware** | 细粒度角色权限控制（超级管理员、养殖户管理员、仓库管理员、品控主管、渠道审计） |

---

## 2. 系统分层架构与目录结构

```
yangcheng-tracehub/
├── docs/                        # 业务需求、系统设计与技术规范文档
│   ├── PRD_ANALYSIS.md          # 需求剖析与业务逻辑
│   ├── TECHNICAL_SELECTION.md   # 技术选型与架构规范
│   ├── DATA_MODEL.md            # 数据模型与 ER 设计
│   └── BUSINESS_RULES.md        # 5大数量守恒与卡控算法
├── prisma/                      # 数据库建模与迁移
│   ├── schema.prisma            # Prisma Schema 核心模型
│   └── seed.ts                  # 初始化种子数据（养殖户、暂养池、角色权限）
├── src/
│   ├── app/                     # Next.js App Router 页面路由
│   │   ├── (auth)/              # 登录与认证页面
│   │   ├── (dashboard)/         # 后台管理主界面 (Sidebar + Header + Main)
│   │   │   ├── farmers/         # 养殖户与围网管理
│   │   │   ├── batches/         # 原料批次与入池登记 (盘点损耗)
│   │   │   ├── pools/           # 暂养池监控与配置
│   │   │   ├── tags/            # 蟹扣领用、核销与日结
│   │   │   ├── outbound/        # 出库申请、打包绑扣、物流回填
│   │   │   ├── approvals/       # 品控审批中心 (领扣/出库/损耗/特批)
│   │   │   ├── ledgers/         # 四大合规台账查询 (支持按日筛选与导出)
│   │   │   ├── trace/           # 批次级全链路反向追溯查询 (渠道隔离)
│   │   │   └── settings/        # 门店档案与系统配置
│   │   └── api/                 # 导出/外部渠道 API
│   ├── components/              # 严格遵循 shadcn/ui 规范的组件
│   │   ├── ui/                  # shadcn/ui 原子组件 (Button, Dialog, Table, Field...)
│   │   ├── forms/               # 业务表单组件 (FarmerForm, BatchIntakeForm...)
│   │   ├── ledgers/             # 台账表格与过滤器
│   │   ├── charts/              # 数量闭环看板图表
│   │   └── layout/              # AppSidebar, Header, Breadcrumbs
│   ├── lib/                     # 核心工具库与基础设施
│   │   ├── prisma.ts            # Prisma Client 单例实例
│   │   ├── validations/         # Zod Schema 业务验证器
│   │   ├── invariants/          # 5大数量守恒业务断言引擎 (核心卡控)
│   │   ├── auth.ts              # 鉴权与当前用户会话
│   │   └── utils.ts             # cn() 等通用工具函数
│   ├── actions/                 # Server Actions (事务级业务处理与审计留痕)
│   │   ├── farmers.ts
│   │   ├── batches.ts
│   │   ├── tags.ts
│   │   ├── outbound.ts
│   │   └── approvals.ts
│   └── types/                   # TypeScript 类型声明与 DTO
├── AGENT.md                     # AI Agent 与开发者核心指令手册
├── package.json
├── tsconfig.json
└── tailwind.config.ts / globals.css
```

---

## 3. 严格遵守 shadcn/ui 组件规范

在本项目中，所有 UI 开发必须**无条件遵守 shadcn/ui 最佳实践与规范**：

1. **表单结构规范**：
   - 严禁使用原始 `div + space-y-*` 搭建表单。
   - 必须使用 `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription` + `FieldError`。
   - 校验状态必须正确绑定 `data-invalid` 到 `Field`，以及 `aria-invalid` 到 input 控件。
2. **布局与间距规范**：
   - 严禁使用 `space-x-*` / `space-y-*`，一律使用 `flex flex-col gap-*` 或 `grid gap-*`。
   - 等宽高元素严格使用 `size-*`（如 `size-8`），禁止 `w-8 h-8`。
3. **颜色与主题规范**：
   - 严禁硬编码颜色类名（如 `text-blue-600`、`bg-green-500`），必须使用语义化 Token：`bg-primary`、`text-muted-foreground`、`bg-destructive/10`、`text-destructive`。
4. **组件组合规范**：
   - `Card` 必须完整包含 `CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`CardFooter`。
   - `Dialog`、`Sheet` 必须包含 `DialogTitle`、`SheetTitle` 以满足无障碍（Accessibility）。
   - 状态展示使用 `Badge` 的对应 `variant`（`default`, `secondary`, `destructive`, `outline`），不手写 `<span>` 样式。
   - 图标在 `Button` 中必须声明 `data-icon="inline-start"` 或 `data-icon="inline-end"`，禁止在图标上写尺寸覆盖类。
