# Architecture overview

> Short source of truth. Contracts: `docs/contracts/`. Agent entry: root `AGENTS.md`.

## Packages

| Package | npm | Role |
|---|---|---|
| `packages/host` | `@monkey-mini-app/host` | AppsManager / GitHistory / Hono / UiCompiler / ToolFacade / config |
| `packages/panel` | `@monkey-mini-app/panel` | Host-agnostic React panel (`PanelHost` seam; no `/api`) |
| `packages/dsh` | `@monkey-mini-app/dsh-mini-app` | dsh adapter: capabilities + lifecycle + client + skills |
| `packages/sdk` | `@monkey-mini-app/ui` | Author package: `useApp` + UI kit re-export + `defineApp` types |
| `packages/ui` | `@monkey-mini-app/ui` | Component kit (bundled into the SDK / iframe) |
| `packages/smoke-test` | — | Integration / sample smoke tests |

Dependency direction (eslint-enforced): `host` ↛ `panel`/`dsh`; `panel` ↛ `host`/`dsh`; `dsh` → `host` + `panel`.

## Composition root

```ts
createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), { config }).apply(ctx)
```

dsh supplies capabilities/lifecycle; another host implements its own. Do not leak dsh types into `host` / `panel` / `sdk`.

## Author surface

- UI: `import { useApp, Button, … } from "@monkey-mini-app/ui"` (+ `react`)
- Backend: `import { defineApp } from "@monkey-mini-app/ui"` (host injects the runtime `defineApp`)
- Layout trees: `ui/**` (UI only), `api/**` (backend only), `shared/**` (isomorphic pure)
- Skill: `skills/monkey-mini-app/`

## Iframe platform

- `/mma/runtime.js` — React
- `/mma/sdk.js` — UI package bundle (kit + `useApp`)
- App UI is compiled by the host; the iframe does not compile.

## Further reading

- [`docs/contracts/skill-sync.md`](../contracts/skill-sync.md) — skill ↔ code gates
- [`docs/contracts/inapp-agent.md`](../contracts/inapp-agent.md) — `ctx.agent`
- [`docs/rfcs/authoring-protocol.md`](../rfcs/authoring-protocol.md) — protocol hard-cut notes
- [`docs/rfcs/pi-extension-port.md`](../rfcs/pi-extension-port.md) — next host (not implemented)
