# agent-mini-app

English | [中文](README.zh.md)

An **AI-native mini-app platform**: an agent can spin up a real React app in one turn,
run it locally, and keep using it. The product is the platform (runtime + panel + SDK).
Agent shells (dsh today, pi later) are adapters.

![home](docs/assets/home.png)

## Why it exists

**Agent-native authoring.** A skill + `mini_app_*` tools + an in-SDK UI kit so a model
can scaffold a high-quality app (`manifest.json` + `ui.tsx` + `main.api.ts`) without
inventing a stack. Icons, tables, charts, editors are already in `@monkey-mini-app/sdk`.

**Mini-apps are the unit of work — and they can call the model back.** Each app is a
small, reloadable program. `main.api.ts` gets a host `ctx`, not a toy sandbox:

| `ctx.*` | What the app can do |
|---------|---------------------|
| `http` / `bash` / `tool` (MCP) | Network, machine, existing tools |
| `llm` / `agent` | Call a model or spawn a sub-agent **from the app** |
| `storage` | Persist data on this machine |

That loop — agent builds an app, the app calls `ctx.llm` / `ctx.agent` — is the point.

**One management panel.** Gallery, open/pin/dock, theme, history, storage, reload.
Same chrome on every host.

**Host-agnostic.** `createHost(capabilities, lifecycle)` + `PanelHost`. dsh web is
the shipped adapter; pi / pi-web is next ([RFC](docs/rfcs/pi-extension-port.md)).
`host` / `panel` / `sdk` do not depend on dsh.

![apps](docs/assets/apps-list.png)
*Gallery in the dsh adapter — same apps on any host that implements the seams.*

![side](docs/assets/sidebar-mode.png)
*Docked: chat left, mini-app right.*

## Mini-app shape

```tsx
// ui.tsx
import { Button, useApp } from "@monkey-mini-app/sdk";

export default function Ui() {
  const { call } = useApp();
  return <Button onClick={() => call("ping")}>ping</Button>;
}
```

```ts
// main.api.ts
import { defineApp } from "@monkey-mini-app/sdk";

export default defineApp({
  name: "Ping",
  description: "one-line app",
  api: { ping: async (ctx) => ctx.appId },
});
```

Both sides import exactly one package: `@monkey-mini-app/sdk` (plus `react` in the UI).
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
| `sdk` | App ABI; iframe `/mma/runtime.js` + `/mma/sdk.js` |
| `ui` | UI kit (bundled into the SDK) |
| `dsh` | dsh adapter (plugin + skill) |

## License

MIT
