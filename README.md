# agent-mini-app

English | [中文](README.zh.md)

An **AI-native mini-app platform** — not a flashy HTML file sitting in the chat. A real
app on your machine, docked next to the conversation, that can use **the same model and
tools** the agent already has.

The product is the platform (runtime + panel + SDK). Agent shells (dsh today, pi later)
are adapters.

![home](docs/assets/home.png)

## Why not a generated HTML page — or a local Python site?

Agents already write pretty HTML, and they can stand up a Flask/FastAPI app that talks
to a database. That is a **one-shot artifact**. Mini-app is for the thing that artifact
cannot do without you becoming the platform:

| | HTML in the chat | Agent-written local site | Mini-app |
|---|---|---|---|
| Still there tomorrow | Lost with the tab | You keep the process, venv, port | First-class app: disk + git + panel |
| Agent can fix the running UI | Screenshot ping-pong | Restart and hope | `reload` → error card → live `view_eval` |
| Button calls **your** model | You paste an API key | You wire OpenAI yourself | `ctx.llm` — same provider/model as the host, structured JSON, cancel |
| Button runs a **real agent turn** | No | You rebuild a tool loop | `ctx.agent` — one-shot, isolated from chat, progress streamed into the app |
| Uses MCP / tools you already connected | No | Re-auth every app | `ctx.tool` / `ctx.mcp` / `ctx.listTools()` — the host's live toolbelt |
| Machine / network | No | You own `requests` + credentials | `ctx.bash` / `ctx.http` as the host user |
| UI quality without inventing a stack | Random Tailwind | Random CSS | In-SDK kit + theme tokens the model is taught to use |
| Many apps, next to chat | Browser tabs | Ports | Gallery, pin, dock left/right |

**A program that stays on the host** — generate it, use it, change it, without starting
over from a new HTML blob.

## What the running app inherits

`main.api.ts` gets a host `ctx`: the same model, tools, and machine the chat agent uses.
Not a toy sandbox:

**Model.** `ctx.llm(prompt, { schema, system, signal })` is the same model the chat
already uses. Ask it to classify a row, draft a reply, extract JSON — get a string
(parse `schema` results). Long jobs honour Stop via `ctx.signal`. You do not ship
another SDK or key.

**Agent.** `ctx.agent(goal)` starts a **one-shot** host agent (not the chat session):
it can loop over tools, stream status/tool events into the UI (`streamTo` +
`useApp().on`), then dispose. A dashboard button can mean “go investigate”, not
“call one completion”.

**Tools you already plugged in.** MCP servers and host tools show up as
`ctx.tool` / `ctx.mcp` / `ctx.listTools()`. The app does not re-declare them. If the
agent can talk to Jira, the browser, or an internal API, a mini-app button can too.

**Machine.** `ctx.http`, `ctx.bash`, `ctx.storage` — network, this computer, JSON
that survives reload. Same trust model as the agent that wrote the app (see below).

That loop — **agent builds the app, the app calls the model and the toolbelt back** —
is the product.

## Authoring, panel, hosts

**Agent-native authoring.** A skill + `mini_app_*` tools + `@monkey-mini-app/ui`
(tables, charts, editors, kanban, theme). The model scaffolds `manifest.json` +
`ui.tsx` + `main.api.ts` without inventing React/Vite/npm. Hot-reload, runtime
errors, and live DOM query close the loop without you.

**One management panel.** Gallery, open/pin/dock, theme, history, storage, reload.
Chat on one side, the app on the other.

**Host-agnostic.** `createHost(capabilities, lifecycle)` + `PanelHost`. dsh web is
the shipped adapter; pi / pi-web is next ([RFC](docs/rfcs/pi-extension-port.md)).
`host` / `panel` / `ui` / `api` do not depend on dsh.

![apps](docs/assets/apps-list.png)
*Gallery in the dsh adapter — same apps on any host that implements the seams.*

![side](docs/assets/sidebar-mode.png)
*Docked: chat left, mini-app right.*

## Mini-app shape

```tsx
// ui.tsx
import { Button, useApp } from "@monkey-mini-app/ui";

export default function Ui() {
  const { call } = useApp();
  return <Button onClick={() => call("ping")}>ping</Button>;
}
```

```ts
// main.api.ts
import { defineApp } from "@monkey-mini-app/api";

export default defineApp({
  name: "Ping",
  description: "one-line app",
  api: { ping: async (ctx) => ctx.appId },
});
```

UI imports `@monkey-mini-app/ui` (+ `react`); backend imports `@monkey-mini-app/api`.
Helper code lives in `ui/` (UI only), `api/` (backend only) or `shared/` (pure, both);
relative imports may not leave the app directory.
Skill (authoring contract): `skills/monkey-mini-app/`.

## Try it

Platform only (no agent shell):

```bash
pnpm dev:host # Vite :5174 · apps host :17900
```

On dsh web (current adapter):

```bash
dsh plugin --profile web add @monkey-mini-app/dsh-mini-app
dsh web --no-open # :3080 · apps host :17880
```

Restart `dsh web` → the mini-app panel (`小程序`). No extra npm packages.

## Develop

**[LOCAL.md](./LOCAL.md)** · **[AGENTS.md](./AGENTS.md)** · **[docs/README.md](./docs/README.md)**

| Package | Role |
|---------|------|
| `host` | Platform: apps, git, HTTP, compile, `mini_app_*` tools, `ctx.*` |
| `panel` | Management panel (`PanelHost`) |
| `ui` | UI kit + iframe `/mma/runtime.js` + `/mma/sdk.js` |
| `api` | Backend `defineApp` contract (host-injected) |
| `dsh` | dsh adapter (plugin + skill) |

## Trust model

This is **owner-operated local software**. Mini-apps run as the host user. `ctx.bash`,
`ctx.http`, and `ctx.llm` are real host capabilities, not a sandbox — that is the point
of the product. The UI iframe isolates a crashed view from the panel; it does not isolate
the machine. This project does not confine what a mini-app can do on your computer.

## License

MIT
