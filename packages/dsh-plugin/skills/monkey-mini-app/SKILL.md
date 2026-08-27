---
name: monkey-mini-app
description: Create or edit local mini-apps (ui.tsx + main.api.ts, Dashboard protocol). Register via mini_app_register; do not Write into ~/.monkey-mini-app.
---

# monkey-mini-app

生成或修改本地小程序。本 skill 在 `~/.dsh/skills/monkey-mini-app/`（`references/`、`templates/` 同级）。

**不要翻 host 源码。不要读现网 `~/.monkey-mini-app/runtime/apps/*/`。**

## 落地（唯一正确路径）

**禁止**用文件工具 Write `~/.monkey-mini-app/runtime/**`（Workspace Write 沙箱会拒绝）。

**只**调用：

```
mini_app_register({
  appId: "com.example.foo",
  files: {
    "manifest.json": "...",
    "ui.tsx": "...",
    "main.api.ts": "...",
    "lib/parse.ts": "..."   // 可选
  }
})
```

然后：

1. `mini_app_call({ appId, method, args })` 冒烟（**不要 curl，不要 bash 打 :17880**）
2. `mini_app_history_commit({ appId, message })`（可选）
3. `mini_app_open({ appId })` —— 会弹出侧栏「小程序」并打开该 app

`mini_app_list` 只需确认插件活着，不必再 `ls` runtime。

## 协议

- UI **禁止** `import` `main.api.ts`
- UI：`const { call } = useDashboardApi()`，自己管 loading；`useDashboardApi` 从 `@monkeyagent/host` 导入（host 注入，不要自己实现）
- 后端：`export default defineDashboard({ name, description, api })`
- `call("foo")` 必须是 `api.foo`
- 后端 import 只许 `@monkeyagent/dashboard` 和 `./lib` `./components`
- 抓网：`ctx.http(url)` / `ctx.http(url, { method, headers, query, body, timeout })`；解析写 `./lib`；模型：`ctx.llm`（返回 **string**）
- 本机命令才用 `ctx.bash`（`{ stdout, stderr, exitCode }`）；`ctx.llm` / `ctx.tool` / `ctx.agent` → **string**
- MCP / tool 参数是普通对象，禁止 `{ input: "..." }`
- 文案给用户看；卡片标题用业务语言（「今日摘要」），不要写 `ctx.bash` / `storage/*.json`
- 要 **JSON 对象** 时用 `ctx.llm(prompt, { schema })` 再 `JSON.parse`，见 [references/llm-json.md](references/llm-json.md)；完整例子是 `templates/news/`
- **长耗时任务（多源抓取 × LLM 分析）只跑采样**：10 个源取 2 个代表性源、LLM 只精析最热 1 批，其余启发式兜底——先验证流程，别让单次调用跑 10 分钟；**必须响应取消**（`ctx.signal`）并提供 `scanStatus`/`progress` 异步进度，见 [references/ctx.md](references/ctx.md)

## UI（@monkey-mini-app/ui）

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
| `ctx.http` / `bash` / `llm` / `agent` / `tool` / `mcp` | [references/ctx.md](references/ctx.md)（逻辑 api call 使用 `ctx.http`，不要 bash curl） |
| **真的要用** `ctx.tool` | 先 `mini_app_list_ctx_tools`，再 [references/tools.md](references/tools.md) |
| 相对 import、`./lib` 解析 | [references/loader.md](references/loader.md) |
| 人类调试 Host `:17880` / curl | [references/test.md](references/test.md)（≠ `ctx.http`） |
| 连通检查 / 最小 UI | `templates/hello/` |
| 筛选、表格类 CRUD | `templates/todo/` |
| RSS + `ctx.http` + `./lib` + 结构化 LLM | `templates/news/` |
| 本机指标 + bash 解析 | `templates/sysmon/` |
| 编辑/diff/日志/用例表格（复杂组件示例） | `templates/fixbench/` |
| 报错 | [references/troubleshoot.md](references/troubleshoot.md) |

普通 storage CRUD **先用上面骨架**，不要为了记笔记去读整份 Todo。模板是风格样板：中文产品文案、`call` 自己管 loading/error、后端可用 TypeScript。

## Checklist

- [ ] `mini_app_register` 落地，没有 Write runtime
- [ ] `mini_app_call` 冒烟通过（不是 curl）
- [ ] `mini_app_open`
- [ ] call 键 ⊆ api 键；UI 无 fetch / secrets / llm
