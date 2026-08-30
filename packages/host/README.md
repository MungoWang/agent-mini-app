# @monkey-mini-app/host

Agent-agnostic local host runtime for many React mini-apps (`manifest.json` + `ui.tsx` +
`main.api.ts`). It owns the process: apps, git, HTTP, UI/Tailwind compile, and the tool
facade. It does **not** know about dsh, and must not depend on `panel` or `dsh`.

## Composition root

```ts
const host = createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), {
  config,
  themes,
});
await host.apply(ctx);   // → { port }; call host.stop() to shut down
```

`createHost` wires the seams below. `capabilities` map to author-facing `ctx.*` via
`bindCapsToContext`; `lifecycle` registers the `mini_app_*` tools and provides services.

## Core pieces

| Export | Role |
|--------|------|
| `createHost` / `Host` | Assemble the runtime; `Host` is the composable core |
| `HostCapabilities` / `HostLifecycle` | The two seams (`*.(callCtx, …)` → `ctx.bash/llm/agent/…`) |
| `AppsManager` | Register/list/serve mini-apps; `AppItem`/`AppContext`/`DashboardDef` |
| `GitHistory` | `isomorphic-git` history (`Commit`/`CommitNode`/`FileStat`) — no child `git` CLI |
| `HttpGateway` / `appRunnerHtml` | Hono HTTP + the iframe app shell |
| `UiCompiler` / `resolveUiDistDir` | esbuild UI compile → self-contained ESM |
| `ToolFacade` / `isMiniAppToolName` | The `mini_app_*` tool set |
| `WorkspacePaths` | The only way to build paths (no hard-coded `~/.monkey-mini-app`) |

## Config

```ts
const config = loadHostConfig();      // fail loud — runtime invents no defaults
const config = bootstrapHostConfig({ runtimeRoot, hostPort });  // tests
```

A missing `host.json` is an error: run `scripts/install-dsh-mini-app.sh` or
`pnpm exec tsx scripts/mma-init.ts`.

## Per-UI compile

Each app's `ui.tsx` is compiled to a self-contained ESM bundle, and its **own** Tailwind
stylesheet is generated in place under `/.autogen/` (`tailwind-gen.css` + `ui.css`). The
authoring entry imports `tailwindcss` (source scan disabled) and `@source`s the app root, so
every app-only class — responsive (`lg:grid-cols-2`), arbitrary (`w-[320px]`) and unique —
lands in that app's sheet. The shared base (theme tokens + shadcn + repo utilities) is
served separately at `/ui.css`; the iframe loads `/ui.css` first, then the app's sheet. Apps
without a `ui.tsx` fall back to the shared `globals.css`. `tailwindcss` is resolved via a
shared runtime-root `node_modules` link so it works outside the repo and after publish.

## HTTP

- `:hostPort/api/apps` — app index
- `:hostPort/app/:id` — iframe app shell
- `:hostPort/api/app/:id/ui/entry.js` — compiled UI bundle
- `:hostPort/api/app/:id/ui.css` — per-app stylesheet
- `:hostPort/ui.css` — shared base stylesheet
- `:hostPort/api/apps/:id/theme` — per-app theme round-trip

## Constraints

- No `panel`/`dsh` dependency (import direction enforced by eslint). The npm package
  ships a tsup `dist/` (transpiled, no source TS) consumed by the dsh server at runtime.
- Paths only through `WorkspacePaths`; git only through `isomorphic-git` (no `child_process`).
- `bootstrapHostConfig` is for tests; real hosts call `loadHostConfig` (fail loud).
