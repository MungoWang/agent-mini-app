# Architecture overview

> Short source of truth. Contracts: `docs/contracts/`. Agent entry: root `AGENTS.md`.

## Packages

| Package | npm | Role |
|---|---|---|
| `packages/host` | `@monkey-mini-app/host` | AppsManager / GitHistory / Hono / UiCompiler / ToolFacade / config |
| `packages/panel` | `@monkey-mini-app/panel` | Host-agnostic React panel (`PanelHost` seam; no `/api`) |
| `packages/dsh` | `@monkey-mini-app/dsh-mini-app` | dsh adapter: capabilities + lifecycle + client + skills |
| `packages/ui` | `@monkey-mini-app/ui` | Author UI package: kit + `useApp`; iframe `/mma/runtime.js` + `/mma/sdk.js` |
| `packages/api` | `@monkey-mini-app/api` | Backend `defineApp` + `AppCtx` types (host injects runtime) |
| `packages/ui-examples` | `@monkey-mini-app/ui-examples` | Portable component examples (demo-host · e2e · skill) — private |
| `packages/smoke-test` | — | Integration / sample smoke tests |

## Composition root

```ts
createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), { config }).apply(ctx)
```

dsh supplies capabilities/lifecycle; another host implements its own. Do not leak dsh types into `host` / `panel` / `sdk`.

## Author surface

- UI: `import { useApp, Button, cn, … } from "@monkey-mini-app/ui"` (+ `react`); `import { groupBy } from "lodash"` (platform vendor → `/mma/vendors/lodash.js`)
- Backend: `import { defineApp } from "@monkey-mini-app/api"` (host injects the runtime `defineApp`); same `lodash` specifier, host-injected
- Layout trees: `ui/**` (UI only), `api/**` (backend only), `shared/**` (isomorphic pure)
- Skill: `skills/monkey-mini-app/`
- Runnable examples: `packages/ui-examples` → copied (byte-for-byte, path-rewritten only) into
  `references/examples/` (`pnpm gen:skill`) and the `com.example.kit` e2e fixture (`pnpm gen:examples`).

## Iframe platform

- `/mma/runtime.js` — React
- `/mma/sdk.js` — UI package bundle (kit + `useApp`)
- `/mma/vendors/lodash.js` — full lodash (UI compiler + backend loader map `lodash` / `lodash-es` here)
- App UI is compiled by the host; the iframe does not compile.

## Authoring loop (what `mini_app_reload` guarantees)

Transpiling proves nothing about running, and the two steps here are deliberately separate
so an agent knows which one failed:

| Stage | Code | Catches |
|---|---|---|
| Backend transpile + module load | `apps/compile-app-source.ts` (sucrase) + `AppsManager.loadMainApi` | syntax, import bounds, missing `defineApp` |
| UI bundle | `compile/ui-compiler.ts` (esbuild, `react`/UI → `/mma/*.js`) | disallowed or unresolvable imports |
| Static pass | `compile/static-check.ts` | **undefined identifiers** — esbuild treats an unbound name as a global, so this class used to reach the browser |

The static pass is parser-only TypeScript (same use as `scripts/check/skill.mjs`): a real
checker would need the published type surface at runtime and would bury the one signal in
type noise. `typescript` is loaded lazily and, if unresolvable, the pass degrades to a
`notices[]` line — a broken linter must not brick reload.

Anything that only fails at render time is reported **by the iframe itself** (it is
cross-origin to the panel, so nothing else can see in) →
[`docs/contracts/runtime-diagnostics.md`](../contracts/runtime-diagnostics.md).

## Further reading

- [`docs/contracts/skill-sync.md`](../contracts/skill-sync.md) — skill ↔ code gates
- [`docs/contracts/inapp-agent.md`](../contracts/inapp-agent.md) — `ctx.agent`
- [`docs/contracts/app-events.md`](../contracts/app-events.md) — `ctx.push` → `useApp().on`
- [`docs/contracts/runtime-diagnostics.md`](../contracts/runtime-diagnostics.md) — runtime errors + DOM outline back to the agent
- [`docs/rfcs/authoring-protocol.md`](../rfcs/authoring-protocol.md) — protocol hard-cut notes
- [`docs/rfcs/pi-extension-port.md`](../rfcs/pi-extension-port.md) — next host (not implemented)
