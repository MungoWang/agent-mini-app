# Mini-app 模板指引

每个模板是不同的**参考场景**：一个「布局原型」× 一条「能力轴」，告诉你**什么时候抄它、它主要教什么**。先看这张表定位，再决定细读哪个模板（避免把 7 个都读一遍）。

| 模板 | 一句话 | 什么时候抄它 | 主要教你 |
|---|---|---|---|
| [minimal](./minimal/) | 最简可运行的骨架 | 刚起步 / 连通检查 / 只要个能跑的壳 | `defineDashboard` + `useDashboardApi().call` 一次往返 + `AppShell`/`PageHeader` 骨架 |
| [todo](./todo/) | 本地 CRUD + 筛选 + 派生统计 | 记本地数据、要增删改查+状态过滤 | `ctx.storage` + 一屏固定内滚 + `FilterBar` + `storage.table()` 多表 |
| [insights](./insights/) | 联网数据 → 模型摘要（长任务） | 外部数据+智能提炼、会慢 | `ctx.http` + `ctx.llm({schema})` + **采样/进度/`ctx.signal` 取消**（`scan`/`scanStatus` 轮询） |
| [monitor](./monitor/) | 本机指标实时看板 | 监控/大盘/图表/KPI | `ctx.system.metrics()` + `ctx.bash`(只做 host 没有的 ps/df) + 轮询隐藏即停 |
| [review](./review/) | 代码/文本对比 + 用例表格 | 审阅/diff/用例、要编辑回写 | `DiffViewer`(original/modified) + `CodeEditor` + `DataGrid` 列筛/排序 + 写回 |
| [agentrun](./agentrun/) | 让模型干多步活并展示过程 | 需要 `ctx.agent`（**唯一**示范）+ 取消/进度 | `ctx.agent` + `onEvent`→storage→UI 轮询 + 模块级 `AbortController` 取消 |
| [jira](./jira/) | 复杂业务仿真（多视图+状态机+AI 辅助） | 工单/Jira/项目管理类、多视图、要 AI | `Kanban`+`DataGrid` 双视图 + 详情 `Sheet` 编辑 + 状态色板 + `ctx.llm` 生成用户可确认草稿 |

## 怎么用

1. **只读你需要的模板**，不要全读。按「一句话 / 什么时候抄它」定位。
2. 模板内带 `// ⭐ 关键：...` 的注释是**教学点** —— 扫注释就能抓到要点（如 `ctx.agent`、`storage.table`、`ctx.signal` 取消、`DiffViewer` 的 original/modified、`StatusBadge` 认小写状态）。
3. **通用约定**（每个都遵守，不分模板）：
   - UI 只 `import`：`react` / `@monkey-mini-app/ui` / `@monkeyagent/host` / `./lib`。禁止其它 npm（app 目录无 node_modules）。
   - 图标：`import { Icon } from "@monkey-mini-app/ui"` → `<Icon.HelpCircle />`（常用子集见 [../references/icons.md](../references/icons.md)）。空状态插图：`import { IlluServerStatus } from "@monkey-mini-app/ui"`。
   - 唯一访问后端的入口：`useDashboardApi().call(method, args)`，method 必须是 `defineDashboard({ api })` 的键。
   - 布局 `AppShell`（可选 `sidebar`/`header`）+ `PageHeader`（`title`/`description`/`actions`）。
   - 列表/看板/表格数据用 `key` 字段做增删改定位。
