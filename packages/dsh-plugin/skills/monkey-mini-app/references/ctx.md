# RunContext `ctx`

每个 `api.*` / `onMount` / `onUnmount` 都拿到同一个 `ctx`。

## 总是可用

| API | 返回 | 说明 |
|-----|------|------|
| `ctx.storage.get(key)` | value 或 `null` | `storage/main.storage.json` |
| `ctx.storage.set(key, value)` | | JSON 可序列化 |
| `ctx.storage.delete` / `clear` | | |
| `ctx.storage.table(name)` | 同样 API | `{name}.storage.json`，name=`[A-Za-z0-9_-]` |
| `ctx.state` | object | 内存，与 defineDashboard.state 同一引用 |
| `ctx.config` | `{ theme, palette, chatLanguage, hostPort, llm }` | 只含本 Host 配置（设置页 / 顶栏配色可改），**不是** dsh 设置 dump。`theme`=`light`/`dark`；`palette`=`default`/`ocean`/`violet`/`slate`（默认/海蓝/青紫/石墨） |
| `ctx.credentials` | `Record<string,string>` | 声明过的密钥 |
| `ctx.log(...args)` | | console |
| `ctx.push(method, params)` | | 常为 no-op |
| `ctx.system.metrics()` | os 快照 | |

## Host 能力

| API | 签名 | 返回 | Fallback | 失败 |
|-----|------|------|----------|------|
| `http(url)` / `http(url, opts)` | opts：`method?` `headers?` `query?` `body?` `timeout?`（默认 8s） | `{ ok, status, headers, text, json }`。`json` 仅当 Content-Type 含 json 且能 parse，否则 `null`。HTTP 4xx/5xx **不 throw**，看 `ok`/`status`。只允许 http/https | Node `fetch` | `http: timeout` / `http: only http/https` / `http: response too large` / `http: …` |
| `bash(command)` | string | `{ stdout, stderr, exitCode }` | 本地 `bash -c` 120s/8MB → dsh `shell.run`。给本机命令用，**不要** `curl` | `bash unavailable` |
| `tool(name, args)` | args **普通对象**，禁止 `{input}` | **string** | dsh tools | `tool: ctx.tools not available` |
| `mcp(name, args?)` | 不要 `mcp_` 前缀 | string | `tool(name)` 再 `tool("mcp__"+name)`。dsh 登记名是 `mcp__<server>__<tool>`，例如 `ctx.mcp("everything__echo", { message: "hi" })` | 第一次错误 |
| `llm(prompt, opts?)` | `opts: { model?, provider?, schema?, system? }` | **string** | 1) `ctx.llm.stream` 2) complete/chat 3) OpenAI HTTP | `llm unavailable: ...` / `llm http N` / `llm stream empty` |
| `agent(goal, opts?)` | `opts: { maxIterations?, schema? }` | string | agents.run/spawn 否则 loop llm | 同 llm |

```ts
const r = await ctx.http("https://example.com/api", {
  method: "GET",
  headers: { accept: "application/json" },
  query: { q: "hi" },
  timeout: 8000,
});
if (!r.ok) throw new Error("HTTP " + r.status);
const data = r.json ?? JSON.parse(r.text);
```

POST：`ctx.http(url, { method: "POST", body: { a: 1 } })`（对象会 JSON 编码）。RSS/HTML 用 `r.text`。

### LLM 路由

`opts.provider/model` → `~/.monkey-mini-app/runtime/llm.json` → 默认 `deepseek-official` / `deepseek-v4-flash`。

dsh 聊天模型走 **`llm.stream({ provider, model, messages })`**。不要因为没看到 `DEEPSEEK_API_KEY` 就认定不能总结。

`opts.schema`：宿主要求只回 JSON（无 markdown）；返回仍是 **字符串**，自己 `JSON.parse`。完整例子 [llm-json.md](llm-json.md)。

给模型的提示宜短：要最终答案、要 JSON 就走 `schema`，不必再堆「不要解释」。


## 列出当前 tool

**仅当 main.api.ts 会调用 `ctx.tool` 时**才调聊天工具 `mini_app_list_ctx_tools`。纯 storage / http / bash / llm 的 app 不要调。

后端也可用 `ctx.listTools()`。不要假设 read/write/bash 一定存在或参数名固定。
