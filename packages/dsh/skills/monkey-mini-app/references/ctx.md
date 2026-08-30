# RunContext `ctx`

每个 `api.*` / `onMount` / `onUnmount` 都拿到同一个 `ctx`。

## 总是可用

| API | 返回 | 说明 |
|-----|------|------|
| `ctx.appId` | string | 当前小程序 reverse-DNS id |
| `ctx.appDir` | string | 当前小程序绝对目录（`runtime/apps/<appId>`） |
| `ctx.storage.get(key)` | value 或 `null` | `storage/main.storage.json` |
| `ctx.storage.set(key, value)` | | JSON 可序列化 |
| `ctx.storage.delete` / `clear` | | |
| `ctx.storage.table(name)` | 同样 API | `{name}.storage.json`，name=`[A-Za-z0-9_-]` |
| `ctx.state` | object | 内存，与 defineDashboard.state 同一引用 |
| `ctx.config` | `{ theme, palette, chatLanguage, hostPort, llm }` | 只含本 Host 配置（设置页 / 顶栏配色可改），**不是** dsh 设置 dump。`theme`=`light`/`dark`；`palette`=`default`/`ocean`/`violet`/`slate`（默认/海蓝/青紫/石墨） |
| `ctx.credentials` | `Record<string,string>` | 声明过的密钥 |
| `ctx.log(...args)` | | console |
| `ctx.signal` | AbortSignal 或 undefined | 当前调用的取消信号（chat 点「停止」时 abort）。长任务在批次/循环间 `if (ctx.signal?.aborted) throw new Error("cancelled")`，`sleep` 也传它 |
| `ctx.push(method, params)` | | 常为 no-op |
| `ctx.system.metrics()` | os 快照 | |

## Host 能力

| API | 签名 | 返回 | Fallback | 失败 |
|-----|------|------|----------|------|
| `http(url)` / `http(url, opts)` | opts：`method?` `headers?` `query?` `body?` `timeout?`（默认 8s）。自动组合 `ctx.signal`（停止即中断） | `{ ok, status, headers, text, json }`。`json` 仅当 Content-Type 含 json 且能 parse，否则 `null`。HTTP 4xx/5xx **不 throw**，看 `ok`/`status`。只允许 http/https | Node `fetch` | `http: timeout` / `http: only http/https` / `http: response too large` / `http: …` |
| `bash(command)` | string | `{ stdout, stderr, exitCode }` | 本地 `bash -c` 120s/8MB → dsh `shell.run`。给本机命令用，**不要** `curl` | `bash unavailable` |
| `tool(name, args)` | args **普通对象**，禁止 `{input}` | **string** | dsh tools | `tool: ctx.tools not available` |
| `mcp(name, args?)` | 不要 `mcp_` 前缀 | string | `tool(name)` 再 `tool("mcp__"+name)`。dsh 登记名是 `mcp__<server>__<tool>`，例如 `ctx.mcp("everything__echo", { message: "hi" })` | 第一次错误 |
| `llm(prompt, opts?)` | 见下方 **ModelCallOptions** | **string** | dsh `llm.stream` | `llm: no dsh model service` / `llm stream empty` |
| `agent(goal, opts?)` | **ModelCallOptions** + `onEvent?`（见下） | **string** | dsh one-shot agent（与聊天 session 隔离）；可用工具循环。不要用多次 `ctx.llm` 假装 agent | `agent: … unbound` / `empty result` / `cancelled` |

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

### ModelCallOptions（`llm` / `agent` 共用最小集合）

```ts
type ModelCallOptions = {
  provider?: string;   // 默认跟 dsh 当前模型；可不传
  model?: string;
  system?: string;
  schema?: object;     // JSON Schema；要对象时用，再 JSON.parse 返回值
  maxTokens?: number;
  signal?: AbortSignal; // api 调用里通常已有 ctx.signal，可省略
};

// llm
await ctx.llm(prompt, opts?: ModelCallOptions): Promise<string>

// agent = ModelCallOptions + onEvent + maxIterations + cwd
await ctx.agent(goal, opts?: ModelCallOptions & {
  /** Soft turn cap: host cancels after this many completed turns. */
  maxIterations?: number;
  onEvent?: (ev: AgentEvent) => void;
  /**
   * Working dir mode (default "process").
   * app = 当前小程序目录；process = dsh 启动目录；temp = 临时目录；custom = 配 cwd 绝对路径。
   * 只传 cwd 路径 ⇒ 视为 custom。cwd + 非 custom 的 cwdType ⇒ 报错。
   */
  cwdType?: "app" | "process" | "temp" | "custom";
  cwd?: string; // 绝对路径；custom 必填，或单独传
}): Promise<string>
```

路由：`opts.provider/model` → dsh 当前 `agent-default-model` → `deepseek-official` / `deepseek-v4-flash`。不必改 `host.json`。

### `opts.schema`（llm + agent）

软约束「只回 JSON」+ 剥 markdown；**返回仍是 string**，`JSON.parse`。例子 → [llm-json.md](llm-json.md)。提示宜短，约束交给 schema。

### `opts.onEvent`（仅 agent）— 过程事件完整形状

返回值仍是最终 string；`onEvent` 只观测过程。UI 用 storage 轮询即可：

```ts
type AgentEvent =
  | { type: "status"; status: "running" | "idle" }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string; args?: unknown; result?: unknown }
  | { type: "turn"; phase: "start"; turn: number }
  | { type: "turn"; phase: "end"; turn: number; reason?: { kind: string; error?: unknown; reason?: unknown } }
  // reason.kind 常见：completed | blocked | error | aborted | max-tokens
  | { type: "error"; message: string }
  | { type: "done"; text: string };

const trace = [];
const text = await ctx.agent("根据材料给出洞察", {
  schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  onEvent: (ev) => {
    trace.push(ev);
    void ctx.storage.set("agentTrace", trace);
  },
});
const insight = JSON.parse(text);
```

`ctx.agent` 与用户聊天 session 隔离（ephemeral，跑完 dispose）。


## 列出当前 tool

**仅当 main.api.ts 会调用 `ctx.tool` 时**才调聊天工具 `mini_app_list_ctx_tools`。纯 storage / http / bash / llm 的 app 不要调。

后端也可用 `ctx.listTools()`。不要假设 read/write/bash 一定存在或参数名固定。

## 长耗时任务：必须采样 + 响应取消

多源抓取 × LLM 分析这类任务，**不要全量跑**：

- **采样走通流程**：10 个 RSS 取 2 个有代表性的源（如主站 + 高热度站）；批次只跑 1 批（如最热的 16~24 条）验证全链路；其余用启发式兜底。告诉用户「先跑样例，全量可后续加」。
- **批次上限**：LLM 分析批次数硬上限（如 `MAX_BATCHES = 2`），避免单次调用跑 10 分钟。
- **必须响应取消**：循环/批次/sleep 处检查 `ctx.signal`：
  ```ts
  async function sleep(ms: number, signal?: AbortSignal) {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  // 批次间
  if (ctx.signal?.aborted) throw new Error("cancelled");
  await sleep(400, ctx.signal);
  ```
- **异步进度**：长任务提供 `scanStatus`/`progress` 类方法（写入 storage），UI 轮询；`scan` 本身 fire-and-forget 立即返回「已启动」。
