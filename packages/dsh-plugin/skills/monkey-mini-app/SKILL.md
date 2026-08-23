---
name: monkey-mini-app
description: Create or edit local mini-apps (ui.tsx + main.api.ts, Dashboard protocol). Register via mini_app_register; do not Write into ~/.monkey-mini-app.
---

# monkey-mini-app

生成或修改本地小程序。本 skill 在 `~/.dsh/skills/monkey-mini-app/`（`references/`、`templates/` 同级）。

**不要翻 host 源码。不要读现网 `~/.monkey-mini-app/runtime/apps/*/。**

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
- UI：`const { call } = useDashboardApi()`，自己管 loading
- 后端：`export default defineDashboard({ name, description, api })`
- `call("foo")` 必须是 `api.foo`
- 后端 import 只许 `@monkeyagent/dashboard` 和 `./lib` `./components`
- 抓网：`ctx.http(url)` / `ctx.http(url, { method, headers, query, body, timeout })`；解析写 `./lib`；模型：`ctx.llm`（返回 **string**）
- 本机命令才用 `ctx.bash`（`{ stdout, stderr, exitCode }`）；`ctx.llm` / `ctx.tool` / `ctx.agent` → **string**
- MCP / tool 参数是普通对象，禁止 `{ input: "..." }`
- 文案给用户看；卡片标题用业务语言（「今日摘要」），不要写 `ctx.bash` / `storage/*.json`
- 要 **JSON 对象** 时用 `ctx.llm(prompt, { schema })` 再 `JSON.parse`，见 [references/llm-json.md](references/llm-json.md)；完整例子是 `templates/news/`

## CRUD 骨架（普通记事直接改这段）

`manifest.json`:

```json
{
  "id": "com.example.foo",
  "name": "名称",
  "description": "一句话",
  "version": "0.1.0",
  "entry": "ui.tsx",
  "theme": { "followsHost": true }
}
```

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

`ui.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button, Empty, Input, Stack, Text, useDashboardApi } from "@monkeyagent/ui";

export default function Ui() {
  const { call } = useDashboardApi();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      setItems((await call("list", {})) || []);
      setError(null);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }
  useEffect(() => { void refresh(); }, []);

  return (
    <Stack gap={16} style={{ padding: 24, maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Text variant="h2">名称</Text>
      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}
      <Input value={draft} placeholder="写一条" onChange={(e) => setDraft(e.target.value)} />
      <Button
        onClick={async () => {
          try {
            await call("add", { title: draft });
            setDraft("");
            await refresh();
          } catch (e) {
            setError(String(e?.message || e));
          }
        }}
      >
        添加
      </Button>
      {!items.length ? <Empty title="还没有内容" /> : items.map((it) => (
        <Text key={it.id}>{it.title}</Text>
      ))}
    </Stack>
  );
}
```

## 按需再读（不要一次全打开）

| 何时 | 打开 |
|------|------|
| `ctx.http` / `bash` / `llm` / `agent` / `tool` / `mcp` | [references/ctx.md](references/ctx.md)（逻辑api call使用 `ctx.http`，不要 bash curl） |
| **真的要用** `ctx.tool` | 先 `mini_app_list_ctx_tools`，再 [references/tools.md](references/tools.md) |
| 相对 import、`./lib` 解析 | [references/loader.md](references/loader.md) |
| 组件名单 / tokens | [references/ui.md](references/ui.md) |
| 人类调试 Host `:17880` / curl | [references/test.md](references/test.md)（≠ `ctx.http`） |
| 连通检查 / 最小 UI | `templates/hello/` |
| 筛选、表格类 CRUD | `templates/todo/` |
| RSS + `ctx.http` + `./lib` + 结构化 LLM | `templates/news/` |
| 本机指标 + bash 解析 | `templates/sysmon/` |
| 报错 | [references/troubleshoot.md](references/troubleshoot.md) |

普通 storage CRUD **先用上面骨架**，不要为了记笔记去读整份 Todo。模板是风格样板：中文产品文案、`call` 自己管 loading/error、后端可用 TypeScript。

## Checklist

- [ ] `mini_app_register` 落地，没有 Write runtime
- [ ] `mini_app_call` 冒烟通过（不是 curl）
- [ ] `mini_app_open`
- [ ] call 键 ⊆ api 键；UI 无 fetch / secrets / llm
