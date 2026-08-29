# Package Consolidation Spec

> Status: approved (2026-08-29). Goal: clear package boundaries, less over-splitting.

## Target packages

| Package | Role |
|---------|------|
| `panel-core` | Pure React panel UI (zero host) |
| `host-core` | Agent-agnostic host: createHost, runtime, node fs, history-git, tools, bridge, ports, builtin themes |
| `ui` | Component library |
| `dsh-plugin` | Sole dsh host shell + adapter + skill path helpers |
| `smoke-test` | Integration tests against the new stack |

## Delete

- `tauri-integration` — recreate when needed
- `adapter-dsh` — superseded by `dsh-plugin/src/dsh-adapter.ts`
- `app-history` — 7-line identity; callers use `HistoryPort` / git adapter directly
- `theme-light`, `theme-dark` — fold tokens into `host-core`
- `agent-skills`, `ui-core`, `host-port`, `bridge-protocol`, `api-client`, `runtime-core`, `adapter-node`, `app-history-git`, `agent-core` — fold into `host-core` (skills helpers into `dsh-plugin`)

## Git: single stack (isomorphic-git only)

- **All** git read/write in product code uses `isomorphic-git` — no `child_process` `git` CLI.
- One module surface in `host-core`: `git.ts` (or `history-git.ts` folded into it) owns:
  - HistoryPort writes: init / commit / listCommits / revert / resetTo
  - Host UI reads: commitCount / log / fileStats / filePreview (with existing TTL cache where useful)
- Tests that assert git helpers must set up repos via isomorphic-git (or the same helpers), not shell `git`.

## host-core layout after merge

```
packages/host-core/src/
  ports.ts                 # HostPort, RuntimePort, HistoryPort, types
  bridge/
    protocol.ts            # encode/decode, Transport
    client.ts              # createMiniClient
  runtime/
    index.ts               # createRuntime
    bridge-hub.ts
    storage.ts
    themes-builtin.ts      # light/dark token packs (runtime ThemeService)
  node-fs.ts               # createNodeHostPort, expandHome, resolvePaths
  git.ts                   # ALL git I/O via isomorphic-git (HistoryPort + read helpers)
  agent-handlers.ts        # createAgentHandlers / listAgentTools / invokeAgentTool
  ui-state.ts              # createUiCore (optional host UI state for provide)
  …existing host.ts, apps.ts, tools.ts, compile-*, etc.
```
## dsh-plugin

- Add `src/skills.ts` (was `agent-skills`: resolve `skills/monkey-mini-app`)
- Stop tsup aliases for deleted packages; keep `noExternal` only for remaining workspace deps (`host-core`, `panel-core`, `ui`)

## Import rule

After merge, **no** `@monkey-mini-app/{runtime-core,adapter-node,...}` imports. Use `@monkey-mini-app/host-core` (or relative within host-core).

## Non-goals

- Do not merge `panel-core` into `dsh-plugin`
- Do not merge `ui` into anything
- Do not implement Tauri now
- No public re-export compatibility shims for deleted package names

## Verification

- `pnpm test` (vitest workspace) green
- `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build` succeeds
- `node --check packages/dsh-plugin/lib/index.js` and `lib/client.js`
- smoke-test exercises `createHost` / dsh adapter path, not deleted `adapter-dsh`
