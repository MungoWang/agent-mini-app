---
name: monkey-mini-app
description: Create local mini-apps with ui.tsx + main.api.ts using defineDashboard and useDashboardApi (monkeyagent protocol).
---

# monkey-mini-app

Protocol:

- UI = `ui.tsx` (default export React component)
- Backend = `main.api.ts` default `defineDashboard({ name, description, api })`
- UI talks to backend **only** via `useDashboardApi().call(method, args)`
- **UI never imports `main.api.ts`.** Host `POST /api/call` runs the Node API.
- API handlers receive `ctx` (RunContext). Do not use raw HTTP in UI.

Do not invent `window.mini.host.invoke`.

## Layout

```
apps/<appId>/                 # reverse-DNS id, equals directory name
  manifest.json
  ui.tsx                      # required UI entry
  main.api.ts                 # required defineDashboard
  components/**/*.{ts,tsx}    # optional UI modules (UI may import)
  lib/**/*.{ts,tsx}           # optional helpers (UI and backend may import)
  storage/*.storage.json      # runtime JSON; do not hand-edit as source
```

- **UI** may split into `components/` + `lib/` with relative imports.
- **Backend** may import `./lib/*` (and `./components/*` if needed). No npm packages except `@monkeyagent/dashboard`.
- `appId` is reverse-DNS and **equals** the directory name.

## manifest.json

```json
{
  "id": "com.example.todo",
  "name": "Todo",
  "version": "0.1.0",
  "entry": "ui.tsx",
  "permissions": ["storage", "ui"],
  "theme": { "followsHost": true }
}
```

## Backend runtime (main.api.ts)

Host compiles each file with a small TS/import transform, then `new Function` + a **scoped require**.

**Allowed**

- `import { defineDashboard } from "@monkeyagent/dashboard"`
- `import { foo } from "./lib/foo"` / `../lib/foo`
- TypeScript types / interfaces (keep them simple; they are stripped)
- `export default defineDashboard(...)`
- `export function` / `export const` from `lib/` files

**Forbidden (throws)**

- `import` from npm (`node-fetch`, `rss-parser`, `openai`, ...)
- Node builtins (`fs`, `http`, ...)
- Imports that escape the app directory

**Minimal backend (bash + llm + lib)**

```ts
import { defineDashboard } from "@monkeyagent/dashboard";
import { parseFeed } from "./lib/parseFeed";

export default defineDashboard({
  name: "News",
  description: "AI agent news + LLM summary",
  api: {
    async refresh(ctx, args) {
      const r = await ctx.bash("curl -fsSL https://hnrss.org/frontpage");
      if (r.exitCode !== 0) throw new Error(r.stderr || "curl failed");
      const items = parseFeed(r.stdout).slice(0, 12);
      const summary = await ctx.llm(
        "Summarize these AI-agent headlines in 5 bullets:\n" + items.map((x) => "- " + x.title).join("\n"),
        { model: "deepseek-chat" }
      );
      await ctx.storage.set("latest", { items, summary, at: Date.now() });
      return { items, summary };
    },
    async latest(ctx) {
      return (await ctx.storage.get("latest")) || { items: [], summary: "" };
    },
  },
});
```

```ts
// lib/parseFeed.ts
export function parseFeed(xml) {
  const items = [];
  const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi;
  let m;
  while ((m = re.exec(xml))) {
    items.push({ title: m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(), url: m[2].trim() });
  }
  return items;
}
```

Reload: cache key is `main.api.ts` mtime. Saving the entry file reloads imported `lib/` as well (cache cleared on each load).

## Host HTTP (smoke without the browser)

Base: `http://127.0.0.1:17880`

| Method | Path | Body | Result |
|--------|------|------|--------|
| GET | `/api/apps` | | `{ apps: [{ id, name, version }] }` |
| POST | `/api/call` | `{ appId, method, args }` | `{ ok: true, value }` or `{ ok: false, error }` |
| GET | `/app/:id` | | runner HTML |
| GET | `/ui-kit.js` | | component bag |
| DELETE | `/api/app/:id` | | `{ ok, appId }` |

```bash
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

## RunContext `ctx`

### Always on

| API | Returns | Notes |
|-----|---------|-------|
| `ctx.storage.get/set/delete/clear` | get → value or `null` | `storage/main.storage.json` |
| `ctx.storage.table(name)` | same API | `{name}.storage.json`, name `[A-Za-z0-9_-]` |
| `ctx.state` | object | in-memory, same ref as defineDashboard.state |
| `ctx.config` | `{ theme, chatLanguage, ... }` | host snapshot |
| `ctx.credentials` | `Record<string,string>` | declared secrets |
| `ctx.log(...args)` | void | console |
| `ctx.push(method, params)` | void | reserved; often no-op |
| `ctx.system.metrics()` | os snapshot | Node `os` |

### Host capabilities — implemented

| API | Signature | Returns | Fallback | Failure |
|-----|-----------|---------|----------|---------|
| `ctx.bash(command)` | string | `{ stdout, stderr, exitCode }` | 1) local `bash -c` 120s/8MB 2) dsh `shell.run` | `bash unavailable` |
| `ctx.tool(name, args)` | args = **plain object**, never `{input:"..."}` | **string** | dsh tools execute/invoke/call | `tool: ctx.tools not available` / `not invokable` |
| `ctx.mcp(name, args?)` | no `mcp_` prefix | string | `tool(name)` then `tool("mcp__"+name)` | first error |
| `ctx.llm(prompt, opts?)` | `opts: { model?, schema? }` | **string** | 1) dsh llm/model/chat 2) OpenAI-compat HTTP | `llm unavailable: no dsh model service bound and no DEEPSEEK_API_KEY/OPENAI_API_KEY` |
| `ctx.agent(goal, opts?)` | `opts: { maxIterations?, schema? }` | **string** | dsh agents.run/spawn else loop llm | same as llm |

LLM HTTP fallback: `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`; base `DEEPSEEK_BASE_URL` / `OPENAI_BASE_URL` or `https://api.deepseek.com`; model `opts.model` or env or `deepseek-chat`. `opts.schema` ⇒ `response_format: json_object`. Return is message **content string**.

Use `ctx.bash("curl ...")` for RSS. Do not import `node-fetch`.

## ui.tsx

```tsx
import { useEffect, useState } from "react";
import { Button, Stack, Text, useDashboardApi } from "@monkeyagent/ui";

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState(null);
  useEffect(() => { void call("latest", {}).then(setData); }, []);
  return (
    <Stack>
      <Text>{(data && data.summary) || "empty"}</Text>
      <Button onClick={() => void call("refresh", {}).then(setData)}>Refresh</Button>
    </Stack>
  );
}
```

`useDashboardApi()` → `{ call(method, args?) }`. No auto-fetch.

**Forbidden in UI:** llm / agent / mcp / bash / fetch / secrets.

UI imports: `react`, `@monkeyagent/ui`, `./components/*`, `./lib/*`.

Tokens: `--background` `--foreground` `--card` `--primary` `--primary-foreground` `--muted` `--muted-foreground` `--border` `--destructive` `--radius`.

Do not read `ui-kit.js` unless changing the kit.

## Runner / CDN

Iframe loads `react` / `react-dom` / `sucrase` from **esm.sh**. Offline or blocked CDN ⇒ UI will not mount.

## Workflow

1. `mini_app_list` → runtimeRoot
2. Write manifest + ui.tsx + main.api.ts (+ lib/components)
3. `mini_app_register`
4. `mini_app_history_commit`
5. Smoke `curl` `/api/call` then `mini_app_open`

## Samples

- `templates/todo/` — storage CRUD
- `templates/sysmon/` — bash + metrics
- `templates/hello/` — ping
- `llm` + `bash` pattern: Minimal backend above

## Checklist

- [ ] ui.tsx default export; main.api.ts defineDashboard name+description+api
- [ ] UI call keys ⊆ api keys
- [ ] no fetch/invoke/secrets in UI
- [ ] backend imports only @monkeyagent/dashboard + relative ./lib ./components
- [ ] bash → {stdout,stderr,exitCode}; llm/tool → string
- [ ] MCP args plain object
- [ ] durable data in ctx.storage
- [ ] curl /api/call works
- [ ] registered + committed

## Anti-patterns

- Backend in App.tsx / window.mini
- import rss-parser / openai in main.api.ts — use ctx.bash + ctx.llm + ./lib
- MCP wrapped as { input: "..." }
- Secrets in UI
