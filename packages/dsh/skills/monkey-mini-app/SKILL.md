---
name: monkey-mini-app
description: Create or edit local mini-apps (ui.tsx + main.api.ts). Create with mini_app_register; edit with mini_app_read + mini_app_edit; verify with mini_app_reload; smoke with mini_app_call; open with mini_app_open.
---

# monkey-mini-app

生成或修改本地小程序。本 skill 在 `~/.dsh/skills/monkey-mini-app/`（`references/`、`templates/` 同级）。

**`ctx` / 模型 API 以本 skill 的 [references/ctx.md](references/ctx.md)、[references/llm-json.md](references/llm-json.md) 为准**（含 `llm` / `agent` / `schema` / `onEvent`）。现网样例不要当契约：不要读 `~/.monkey-mini-app/runtime/apps/*/`。

## 文件怎么落地

Workspace 直接 Write `~/.monkey-mini-app/runtime/**` 会被沙箱拒绝，一律走 `mini_app_*` 工具。

### 新建 app → `mini_app_register`

脚手架创建（要 `manifest.json`）。`files` 的 **key 是相对路径**（动态名字），value 是全文；自动建目录。常见还有 `ui.tsx`、`main.api.ts`，按需 `lib/...`、`components/...`（禁止 `..` / 绝对路径）：

```
mini_app_register({
  appId: "com.example.foo",
  files: {
    "manifest.json": "...",
    "ui.tsx": "...",
    "main.api.ts": "...",
    "lib/parse.ts": "...",
    "components/Card.tsx": "..."
  }
})
```

### 改已有文件 → `read` + `edit`（主路径）

不要再用 `register` 整树重写来改一行。

```
mini_app_list_files({ appId })
mini_app_read({ appId, path: "ui.tsx" })
// 可选行窗（1-indexed 闭区间）：startLine/endLine；也可 offset+limit（Pi 风格）
// mini_app_read({ appId, path: "ui.tsx", startLine: 10, endLine: 40 })
// mini_app_read({ appId, path: "main.api.ts", offset: 1, limit: 80, numbered: true })
mini_app_edit({
  appId,
  path: "ui.tsx",
  edits: [{ oldText: "旧片段（须唯一）", newText: "新片段" }],
  // commit: false   // 多轮小改可先不提交，最后 reload 收口
})
```

- **新建单文件 / 大段重写** → `mini_app_write({ appId, path, content })`
- **删文件** → `mini_app_delete({ appId, path })`（不能删 `manifest.json`）
- mutate 默认 **auto-commit**；设 `commit: false` 可攒改动

### 验证 + 预热缓存 → `mini_app_reload`

改完一轮后调用（**替代旧的 `mini_app_validate`**）：校验 + **同步编译** `main.api` 与 UI；成功且工作区有未提交改动会 auto-commit。

```
mini_app_reload({ appId })  // { ok, errors, compiled, committed? }
```

然后：

1. `mini_app_call({ appId, method, args })` 冒烟（不是 curl / 不是 bash 打 `:17880`）
2. `mini_app_open({ appId })` —— 弹出侧栏「小程序」并打开该 app

`mini_app_list` 只需确认插件活着。显式 `mini_app_history_commit` / `_list` / `_reset` / `_revert` 仍可用。

## 协议

- UI **禁止** `import` `main.api.ts`
- UI：`const { call } = useDashboardApi()`，自己管 loading；`useDashboardApi` 从 `@monkeyagent/host` 导入（host 注入，不要自己实现）
- 后端：`export default defineDashboard({ name, description, api })`
- `call("foo")` 必须是 `api.foo`
- 后端 import 只许 `@monkeyagent/dashboard` 和 `./lib` `./components`
- 抓网：`ctx.http(url)` / `ctx.http(url, { method, headers, query, body, timeout })`；解析写 `./lib`
- 本机命令才用 `ctx.bash`（`{ stdout, stderr, exitCode }`）
- **模型**：`ctx.llm(prompt, opts?)` / `ctx.agent(goal, opts?)` → **string**。共用 opts：`provider?` `model?` `system?` `schema?` `maxTokens?` `signal?`；agent 另加 `onEvent?`。结构化 JSON → [llm-json.md](references/llm-json.md)；过程事件与完整签名 → [ctx.md](references/ctx.md)
- MCP / tool 参数是普通对象，禁止 `{ input: "..." }`；`ctx.tool` / `ctx.agent` / `ctx.llm` 返回值都是 **string**（tool/mcp 经宿主 stringify）
- 文案给用户看；卡片标题用业务语言（「今日摘要」），不要写 `ctx.bash` / `storage/*.json`
- **长耗时任务只跑采样** + 必须响应 `ctx.signal` + `scanStatus`/`progress`，见 [ctx.md](references/ctx.md)

## UI（@monkey-mini-app/ui）

**组件库是「参考 / 便利」，不是硬性规范。** 它只是帮你省掉重复造轮子——合适的场景直接用，但**别为了用组件而用**。允许完全自由的发挥：

- **先判断**：这个 UI 有没有现成组件？**有且合适 → 用**（省 token、风格统一）；**没有、或要独特视觉/交互、或用户明确要「自由发挥」→ 用原生元素（`div`/`span`/`button`/`input`/`table`/`svg`…）+ Tailwind classes 自行实现**，不用迁就组件库去硬凑。
- **可混用**：骨架（卡片/页头/弹窗）用库组件，细节或视觉特殊处用原生 + Tailwind。
- **自由发挥的边界**：原生元素 + Tailwind 随意；但 UI 仍**只能** import `react` / `@monkey-mini-app/ui` / `@monkeyagent/host` / 相对 `./lib`（编译器限制，**不能 import 任意 npm 包**）。需要图表/图标/编辑器等能力时从 `@monkey-mini-app/ui` 拿，或自己用 CSS/SVG 实现。
- **不用管的**：`UiProvider` host 自动包裹；布局用 Tailwind classes（库里没有 Stack/Text 这类布局件）。

下面是「常用姿势」示例，**不是唯一写法**——复杂/特殊 UI 完全可以全手写。

```tsx
import { useEffect, useState } from "react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Textarea } from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

export default function Ui() {
  const { call } = useDashboardApi();
  const [draft, setDraft] = useState("");
  ...
  return (
    <Card className="mt-8 w-full">
      <CardHeader><CardTitle>名称</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="写一条" />
        <Button onClick={async () => { await call("add", { title: draft }); }}>添加</Button>
      </CardContent>
    </Card>
  );
}
```

- **布局用 Tailwind classes**（`flex flex-col gap-3 p-4 grid md:grid-cols-3 w-full space-y-4`），库内没有 Stack/Text 这类布局组件
- **`UiProvider` 由 host 自动包裹**（locale 跟随 host 设置），不要自己写 Provider
- 组件清单（props + 类型 + 示例）→ **[references/catalog.md](references/catalog.md)** 与 **[references/contracts/](references/contracts/)**（自动生成，改组件后 `pnpm skill:gen` 再生成）
- **图标**：`import { Icon } from "@monkey-mini-app/ui"` 后用 `Icon.HelpCircle`（任意 lucide 名都行）；**常用推荐子集 + 何时用** → **[references/icons.md](references/icons.md)**（不要读上千个名，看这份精简的）
- **空状态插图**：`import { IlluServerStatus } from "@monkey-mini-app/ui"`（`Illu*`，已 token 化跟主题）
- 组件库已内置 lucide 图标 / recharts / CodeMirror 等依赖——**不要**额外 import 这些 npm 包；从 `@monkey-mini-app/ui` 拿

| 场景 | 组件 |
|---|---|
| 页面骨架 | `AppShell` `PageHeader` `FilterBar` `DetailPanel` |
| KPI 卡片 | `StatCard` `TrendCard` `StatusBadge` `SeverityChip` |
| 表格 | `DataGrid` + `ColumnDef`（排序/筛选/分页/CSV 自带） |
| 日期时间 | `DatePicker` `DateRangePicker` `DateTimePicker` `TimePicker` `DurationInput` `RelativeDatePicker` |
| 看板/日历/计划 | `Kanban` `EventCalendar` `Gantt` `Timeline` `Stepper` |
| 树/列表 | `TreeView` `SortableList` `FileTree` |
| 编辑器 | `CodeEditor` `MarkdownEditor` `RichTextEditor` `CodeBlock` `Markdown` |
| 检查/日志 | `DiffViewer` `JsonViewer` `LogViewer` `RequestInspector` `Terminal` |
| 表单扩展 | `SearchInput` `NumberField` `TagInput` `ConfirmDialog` `FileDropzone` `Copyable` `UserPicker` |
| 图表 | `DonutChart` `StackedBarChart` `Sparkline` `Gauge` `RadarChart` + L1 `Chart` |
| 基础件 | `Button` `Input` `Select` `Dialog` `Sheet` `Tabs` `Card` `Badge` `Toast` `Empty` … |

## CRUD 骨架（普通记事直接改这段）

`manifest.json`:

```json
{
  "id": "com.example.foo",
  "name": "名称",
  "description": "一句话",
  "version": "0.1.0",
  "entry": "ui.tsx",
  "theme": { "followsHost": true },
  "acronym": "MC"
}
```

`acronym`（可选）：双字母缩写，用于 Host 列表的卡片 monogram。不写时按中文名拼音声母自动生成（「备忘录」→ BW），英文名取前两个字母。只有想自定义缩写时才需要填（如品牌名）。

`main.api.ts`:

```ts
import { defineDashboard } from "@monkeyagent/dashboard";

async function loadItems(ctx) {
  const items = await ctx.storage.get("items");
  return Array.isArray(items) ? items : [];
}

export default defineDashboard({
  name: "名称",
  description: "一句话",
  api: {
    async list(ctx) {
      return loadItems(ctx);
    },
    async add(ctx, args) {
      const title = String(args?.title ?? "").trim();
      if (!title) throw new Error("请填写标题");
      const items = await loadItems(ctx);
      const item = { id: "i_" + Date.now(), title, createdAt: Date.now() };
      items.unshift(item);
      await ctx.storage.set("items", items);
      return item;
    },
    async remove(ctx, args) {
      const items = (await loadItems(ctx)).filter((x) => x.id !== args?.id);
      await ctx.storage.set("items", items);
      return { ok: true };
    },
  },
});
```

## 按需再读（不要一次全打开）

| 何时 | 打开 |
|------|------|
| 组件 props / 类型 / 示例 | [references/catalog.md](references/catalog.md) → [references/contracts/](references/contracts/) |
| 图标子集（`Icon` 命名空间，何时用） | [references/icons.md](references/icons.md) || `ctx.*` 完整契约（含 agent `onEvent` 事件形状） | [references/ctx.md](references/ctx.md)（用 `ctx.http`，不要 bash curl） |
| `schema` 结构化 JSON 例子 | [references/llm-json.md](references/llm-json.md) |
| **真的要用** `ctx.tool` | 先 `mini_app_list_ctx_tools`，再 [references/tools.md](references/tools.md) |
| 相对 import、`./lib` 解析 | [references/loader.md](references/loader.md) |
| 人类调试 Host `:17880` / curl | [references/test.md](references/test.md)（≠ `ctx.http`） |
| 骨架基线 / 最小可运行结构 | `templates/minimal/` |
| 本地 CRUD + 筛选 + 派生统计 | `templates/todo/` |
| 联网数据 → 模型摘要（长任务/采样/取消） | `templates/insights/` |
| 本机指标实时看板（system + bash） | `templates/monitor/` |
| 编辑/diff/日志/用例表格（复杂组件示例） | `templates/review/` |
| `ctx.agent` 多步任务 + 过程/取消 | `templates/agentrun/` |
| 看板/表格双视图 + 编辑 + AI（flagship） | `templates/jira/` |
| **先把 7 个模板的指引侧重读一遍再选** | [`templates/README.md`](templates/README.md) |
| 报错 | [references/troubleshoot.md](references/troubleshoot.md) |

普通 storage CRUD **先用上面骨架**，不要为了记笔记去读整份 Todo。模板是风格样板：中文产品文案、`call` 自己管 loading/error、后端可用 TypeScript。

## Checklist

- [ ] 新建用 `mini_app_register`；改已有用 `mini_app_read` + `mini_app_edit`（或 `write`）
- [ ] `mini_app_reload` 编译通过
- [ ] `mini_app_call` 冒烟通过（不是 curl）
- [ ] `mini_app_open`
- [ ] call 键 ⊆ api 键；UI 无 fetch / secrets / llm
