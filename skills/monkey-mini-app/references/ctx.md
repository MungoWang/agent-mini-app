# RunContext `ctx`

Every `api.*` method (`defineApp({ api })` keys) receives the same `ctx`.

## Always available

| API | Returns | Notes |
|-----|---------|-------|
| `ctx.appId` | string | Reverse-DNS id of the running mini-app |
| `ctx.appDir` | string | Absolute directory of this app (`runtime/apps/<appId>`) |
| `ctx.storage.get(key)` | value or `null` | Backed by `storage/main.storage.json` |
| `ctx.storage.set(key, value)` | | Value must be JSON-serialisable |
| `ctx.storage.delete` / `clear` | | |
| `ctx.storage.table(name)` | same API | Separate file `{name}.storage.json`; `name` = `[A-Za-z0-9_-]` |
| `ctx.state` | object | In-memory; the same reference as `defineApp.state` |
| `ctx.config` | `{ theme, palette, chatLanguage, hostPort, llm }` | This host's own settings only (settings page / top bar), **not** a dsh settings dump. `theme` = `light`\|`dark`\|`system` (a *preference* — resolve `system` yourself if you need a concrete mode); `palette` = `default`\|`ocean`\|`violet`\|`slate` |
| `ctx.credentials` | `Record<string,string>` | Secrets **supplied by the host** — a mini-app cannot declare them. `{}` when the host has no credential service: read by key, show a usable empty state when missing, never invent key names |
| `ctx.log(...args)` | | console |
| `ctx.signal` | AbortSignal or undefined | Cancel signal for the current call (aborted when the user hits "stop"). In long jobs check `if (ctx.signal?.aborted) throw new Error("cancelled")` between batches/loops and pass it to `sleep` too |
| `ctx.push(name, params)` | SSE to this app's UI | Live channel for `useApp().on(name, cb)`. Fire-and-forget, never throws; `params` must be JSON-serialisable. Host keeps the last 200 events **per app**, so a reconnecting or later-opened UI replays them (`Last-Event-ID`) |
| `ctx.system.metrics()` | os snapshot | |

## Host capabilities

| API | Signature | Returns | Fallback | Failure |
|-----|-----------|---------|----------|---------|
| `http(url)` / `http(url, opts)` | opts: `method?` `headers?` `query?` `body?` `timeout?` (default 8s). Automatically combines `ctx.signal` (stop aborts the request) | `{ ok, status, headers, text, json }`. `json` is set only when Content-Type contains json **and** parsing succeeds, else `null`. HTTP 4xx/5xx **do not throw** — check `ok`/`status`. http/https only | Node `fetch` | `http: timeout` / `http: only http/https` / `http: response too large` / `http: …` |
| `bash(command)` | string | `{ stdout, stderr, exitCode }` | Local `bash -c`, 120s/8MB → dsh `shell.run`. For machine commands; **do not** shell out to `curl` | `bash unavailable` |
| `tool(name, args)` | args is a **plain object**, never `{input}` | **string** | dsh tools | error containing `tool:` when the host exposes no tool service |
| `mcp(name, args?)` | no `mcp_` prefix | string | tries `tool(name)` then `tool("mcp__"+name)`. dsh registers `mcp__<server>__<tool>`, e.g. `ctx.mcp("everything__echo", { message: "hi" })` | first-attempt error |
| `llm(prompt, opts?)` | see **ModelCallOptions** below | **string** | dsh `llm.stream` | `llm: no dsh model service` / `llm stream empty` |
| `agent(goal, opts?)` | **ModelCallOptions** + `onEvent?` (below) | **string** | dsh one-shot agent (isolated from the chat session); may loop over tools. Do not fake an agent with repeated `ctx.llm` calls | `agent: … unbound` / `empty result` / `cancelled` |

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

POST: `ctx.http(url, { method: "POST", body: { a: 1 } })` (objects are JSON-encoded). For RSS/HTML use `r.text`.

### ModelCallOptions (shared minimum for `llm` / `agent`)

```ts
type ModelCallOptions = {
  provider?: string;   // defaults to the host's current model; usually omitted
  model?: string;
  system?: string;
  schema?: object;     // JSON Schema — use it when you need an object, then JSON.parse the result
  maxTokens?: number;
  signal?: AbortSignal; // ctx.signal already exists inside an api call, so this is optional
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
   * app = this mini-app's directory; process = host start dir; temp = temp dir; custom = absolute cwd.
   * Passing only a cwd path implies custom. cwd + a non-custom cwdType is an error.
   */
  cwdType?: "app" | "process" | "temp" | "custom";
  cwd?: string; // absolute path; required for custom
}): Promise<string>
```

Routing: `opts.provider/model` → host `agent-default-model` → `deepseek-official` / `deepseek-v4-flash`. No `host.json` edit needed.

### `opts.schema` (llm + agent)

A soft "reply with JSON only" constraint plus fence stripping — **the return value is still a string**, you `JSON.parse` it. Examples → [llm-json.md](llm-json.md). Keep the prompt short: state the task, push the constraints into `schema`.

### `opts.onEvent` (agent only) — full event shapes

The return value is still the final string; `onEvent` only observes the run. To show progress in the UI pass
`streamTo: "agent"` — the host mirrors every event as `ctx.push("agent", event)`:

```ts
await ctx.agent(goal, { streamTo: "agent", maxIterations: 12 });
// UI: on("agent", (ev) => …) — see templates/agentrun
```

```ts
type AgentEvent =
  | { type: "status"; status: "running" | "idle" }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string; args?: unknown; result?: unknown }
  | { type: "turn"; phase: "start"; turn: number }
  | { type: "turn"; phase: "end"; turn: number; reason?: { kind: string; error?: unknown; reason?: unknown } }
  // common reason.kind: completed | blocked | error | aborted | max-tokens
  | { type: "error"; message: string }
  | { type: "done"; text: string };

const trace = [];
const text = await ctx.agent("Summarise the material into insights", {
  schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  onEvent: (ev) => {
    trace.push(ev);
    void ctx.storage.set("agentTrace", trace);
  },
});
const insight = JSON.parse(text);
```

`ctx.agent` is isolated from the user's chat session (ephemeral, disposed when it finishes).

## Listing live tools

Call the chat tool `mini_app_list_ctx_tools` **only when `main.api.ts` will actually use `ctx.tool`**. Skip it for storage / http / bash / llm-only apps.

The backend can also call `ctx.listTools()`. Never assume `read` / `write` / `bash` exist or that their parameter names are stable.

## Long jobs: sample and honour cancellation

Multi-source fetch × LLM analysis — **do not run it in full**:

- **Sample the flow end to end**: of 10 RSS feeds take 2 representative sources; of N batches run 1 (e.g. the hottest 16–24 items) to prove the whole path; fall back to heuristics for the rest. Tell the user "sample first, full run is a switch away".
- **Hard batch cap**: limit LLM batches (e.g. `MAX_BATCHES = 2`) so one call never runs ten minutes.
- **Always honour cancellation**:
  ```ts
  async function sleep(ms: number, signal?: AbortSignal) {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  // between batches
  if (ctx.signal?.aborted) throw new Error("cancelled");
  await sleep(400, ctx.signal);
  ```
- **Async progress**: `ctx.push(name, payload)` from the background job; the UI fetches one snapshot on mount (`runStatus`) and then applies pushed events — do **not** `setInterval` a status method. Keep writing the snapshot to storage as well, so an app opened cold still shows the last state. Buffer is 200/app: if the UI sees an `app:gap` (`onAny` receives `{ name: "*", data: { gap: true } }`), refetch the snapshot.
