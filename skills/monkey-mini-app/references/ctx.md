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
| `ctx.storage.table(name)` | same API | Independent table in the same app (`{name}.storage.json`); `name` = `[A-Za-z0-9_-]` |
| `ctx.storage.bytes()` | number | Bytes this table occupies — for your own "is this getting big" logging |
| `ctx.state` | object | In-memory; the same reference as `defineApp.state` |
| `ctx.config` | `{ theme, palette, chatLanguage, hostPort, llm }` | This host's own settings only (settings page / top bar), **not** a dsh settings dump. `theme` = `light`\|`dark`\|`system` (a *preference* — resolve `system` yourself if you need a concrete mode); `palette` = `default`\|`ocean`\|`violet`\|`slate` |
| `ctx.credentials` | `Record<string,string>` | Secrets **supplied by the host** — a mini-app cannot declare them. `{}` when the host has no credential service: read by key, show a usable empty state when missing, never invent key names |
| `ctx.log(...args)` | | console |
| `ctx.signal` | AbortSignal or undefined | Cancel signal for the current call (aborted when the user hits "stop"). In long jobs check `if (ctx.signal?.aborted) throw new Error("cancelled")` between batches/loops and pass it to `sleep` too |
| `ctx.push(name, params)` | SSE to this app's UI | Live channel for `useApp().on(name, cb)`. Fire-and-forget, never throws; `params` must be JSON-serialisable. Host keeps the last 200 events **per app**, so a reconnecting or later-opened UI replays them (`Last-Event-ID`) |
| `ctx.system.metrics()` | os snapshot | |

## Typed events

`ctx.push("stage", …)` and `useApp().on("stage", …)` are joined by a **string**, and no type can
cross the seam: `ui.tsx` may not import `main.api.ts` (AGENTS.md → Hard constraints 1), so the
compiler cannot see that the two names must agree. A typo produces an app that renders perfectly
and never updates.

Declare the names once in `shared/` — the one tree both sides may import — and let the literal be
the source of truth:

```ts
// shared/events.ts  (pure isomorphic: no React, no ctx, no DOM)
export const EV = {
  progress: "progress",
  latest: "latest",
} as const;

export type Events = {
  progress: { running: boolean; step: string; done: number; total: number; error?: string };
  latest: { items: { title: string }[]; digest: { headline: string; bullets: string[] } | null; at: number };
};

export type Progress = Events["progress"];
export type Payload = Events["latest"];
```

```ts
// api/scan.ts  (or main.api.ts)
import { EV, type Progress } from "../shared/events";
const next: Progress = { running: true, step: "fetch", done: 1, total: 3 };
ctx.push(EV.progress, next);
```

```tsx
// ui.tsx
import { EV, type Progress } from "./shared/events";
const { on } = useApp();
useEffect(() => on(EV.progress, (p) => setProgress(p as Progress)), [on]);
```

Rename `EV.progress` once — both sides move. The `Events` map is the payload contract.
Worked example: `templates/radar/shared/events.ts`. `mini_app_reload` still notices a leftover
string literal that nothing pushes (`"stga"`); names that go through `EV.*` are the source of truth.

## Choosing a table

Tables are independent namespaces over the same API: `ctx.storage.table("reads")` gives you a table
whose keys cannot collide with the default one. There is no `keys()`, no enumeration and no query —
every method addresses exactly one key. Each table is one JSON file; every `set` rewrites that file,
so **what shares a table is a real cost**, not just a naming preference:

| Data | Put it in |
|---|---|
| A handful of settings (source list, thresholds, UI prefs) | default `ctx.storage` — small, and you read it whole anyway |
| Anything that **grows**: fetched article bodies, run logs, activity, per-day records, snapshots | its own `ctx.storage.table("reads")` |
| Both of the above in one app | two tables — otherwise your settings rewrite rides along with every log line |

Large lists should be **one key per row** (`await rows.set(id, row)`), not one giant array under a
single key. `ctx.storage.bytes()` answers "how big is this table right now". Past roughly 512 KB the
host surfaces a **panel banner** (writes are never blocked) with the heaviest keys and a copy-paste
prompt you can hand to an agent to do the split.

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
  maxTokens?: number; // host default 4096 when unset — raise it for wide arrays
  retryTimes?: number; // attempts IN TOTAL (1 = no retry); llm default 3, agent default 1
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
// UI: on("agent", (ev) => …) — see templates/runner
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
    ctx.push("agentEvent", ev); // live to the UI; do NOT persist per event — that rewrites the
                                 // whole file once per step, for a buffer nobody reads mid-run
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
