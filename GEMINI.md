# AI Agent Guidelines for yangcheng-tracehub (GEMINI.md)

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

---

## 1. Domain Worldview & 5 Core Invariants (系统五大数量守恒硬约束)

本系统是**数量闭环管控与供应链合规证明系统**（非防伪防串货系统），证明：**发出的带扣蟹总量 $\le$ 签约养殖户的理论核定产量**。

1. **源头额度卡控**：$\sum \text{Batch.inPoolCount}_{\text{year}} \le \text{Farmer.area} \times 600$（超额须 `ADMIN` 特批并在 `SpecialApproval` 表留痕）。
2. **蟹扣领用余量**：$\text{TagClaim.count} \le \min\left(\text{Farmer.activeInPool}, \text{Farmer.remainingQuota}\right)$。
3. **批次在池存活**：$\text{BookInPool} = \text{inPool} - \text{outPool} - \text{lossCount} \ge 0$。
4. **单票出库校验**：$\text{OutboundCount} = \text{ChannelOrderCount} \le \text{Batch.BookInPool}$。
5. **蟹扣日结轧平**：$\text{当日领扣数} = \text{当日绑扣出库数} + \text{当日退回数} + \text{当日作废数}$。
6. **暂养池防混池**：同公母且同重量档位方可复用入池；异规格绝对禁止混池；池内有活蟹禁止物理删除。
7. **损耗盘点制**：$\text{本次损耗} = \text{账面在池} - \text{实盘数量}$，禁止负损耗；损耗率 $> 5\%$ 强制必填原因并标红告警。

---

## 2. Tech Stack & Architecture (技术选型与架构)

- **框架**：Next.js 15 (App Router + Server Actions + React 19)
- **数据库**：Prisma ORM 6.x + SQLite (`prisma/dev.db` 本地) / PostgreSQL (生产)
- **UI & 样式**：shadcn/ui (New York / Nova) + Tailwind CSS v4 语义化 Token + Lucide React + Motion
- **校验 & 规则**：Zod (`src/lib/validations/schemas.ts`) + 纯函数守恒引擎 (`src/lib/invariants.ts`)

---

## 3. UI Development Rules (shadcn/ui 规范)

- 表单必须使用 `Form` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` 标准组件树（结合 `react-hook-form` 与 `zodResolver`）。
- 弹窗必须使用带 `DialogTitle`、`DialogDescription`（或视觉隐藏加 `sr-only`）的规范 `Dialog` 组件。
- 严禁硬编码颜色类名（如 `text-blue-600`），必须使用语义化设计令牌（`bg-background`, `text-foreground`, `bg-primary`, `text-destructive` 等）。
- 间距使用 `gap-*`，尺寸使用 `size-*`，禁止手写过时的 `space-x-*` / `space-y-*`。

---

## 4. Build & Verification Rules (编译与验证准则)

- ❌ **NEVER** run `pnpm build` or `next build` to verify code changes during active development, as it deletes and overwrites the `.next` directory and crashes the user's running `next dev` server with `ENOENT: routes-manifest.json` or missing chunk errors.
- ✅ **ALWAYS** use `pnpm typecheck` (`tsc --noEmit`) to verify TypeScript correctness.
- ✅ **ALWAYS** use `pnpm test:unit` (`tsx tests/invariants.test.ts`) to verify invariant math rules.
- ✅ **ALWAYS** use `pnpm test:e2e` (`tsx tests/e2e-workflow.test.ts`) to verify full business closed-loop workflows.

