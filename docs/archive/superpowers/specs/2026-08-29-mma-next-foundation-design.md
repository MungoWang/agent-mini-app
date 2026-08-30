# MMA Next Foundation Design

> Status: **draft for review** (2026-08-29)  
> Goal: parallel clean packages (`host` / `panel` / `dsh`) with harness-aligned style, hard engineering gates, and explicit config/path/i18n/HTTP boundaries. Old `host-core` / `panel-core` / `dsh-plugin` remain until cutover.

## 1. Goals & non-goals

### Goals

- Solid foundation: strict TypeScript, no `@ts-nocheck` / implicit `any`, lint/format, import boundaries, coverage ≥85% on **host + panel + dsh**, install smoke.
- Implementation matches the intended abstractions (not a second generation piled on the first).
- OOP + constructor DI where there is state/lifecycle; pure functions for transforms — aligned with [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) role naming, without mindless class-everything.
- Paths and config have a single owner; runtime never mindlessly `??` defaults.
- i18n and HTTP stack chosen for maintainability from day one.

### Non-goals (v1)

- Rewriting `@monkey-mini-app/ui`.
- Tauri / multi-root workspaces.
- Full Cordis Service Definition/Provider/Consumer package split per capability (too heavy for this product size).
- Per-file 100% coverage (harness CI style).

## 2. Package surface (Approach A)

| Directory | npm name | Role |
|-----------|----------|------|
| `packages/host` | `@monkey-mini-app/host` | Agent-agnostic host: `Host`, apps, git, Hono HTTP, compile, tools facade |
| `packages/panel` | `@monkey-mini-app/panel` | Pure React panel (no `/api`, no dsh); depends on lucide + react, **not** `ui` |
| `packages/dsh` | `@monkey-mini-app/dsh-mini-app` | Cordis plugin + client + skills; implements platform/lifecycle/panel host |
| `packages/ui` | `@monkey-mini-app/ui` | Unchanged component library; **host** may depend for compile-ui only |

**Dependency direction (lint-enforced):**

```
ui ← host
     ↑
panel ← dsh-mini-app → host
         ↑
       (react peers)
```

- `host` must not import `panel` or `dsh`.
- `panel` must not import `host` or `dsh`.
- Old packages stay until cutover, then delete.

**Display note:** dsh strips scope and `dsh-` prefix from npm names; `@monkey-mini-app/dsh-mini-app` may show as `mini-app` in the plugin list. Runtime id remains `export const name = 'monkey-mini-app'`.

## 3. Style system (summary)

- **Stateful / lifecycle → `class`** with `private readonly` constructor injection; **no heavy IO in constructors** — use `start`/`stop`.
- **Pure transforms → functions** in domain files (`manifest.ts`), never a dumping `utils.ts`.
- **Role suffixes:** Host, Manager, Gateway, Executor, Registry, Store, Policy, Presenter (see harness cookbook). Prefer capability names over `Adapter`.
- **Factory** (`createHost`) only assembles; business lives on classes.
- **`types.ts`:** types only. **Tests:** package-level `tests/`. **Imports:** cross-package by package name; relative imports use **`.ts`** suffix (harness-aligned).
- Full coding-practice checklist lives in §11.

## 4. Paths: `WorkspacePaths`

- **One class** owns all path composition under a runtime root.
- Business code never contains `~/.monkey-mini-app` or `homedir()` + mini-app joins.
- Relative layout segments live only on `WorkspacePaths` (e.g. `Rel.apps`, `Rel.hostConfig`, `Rel.ui`).
- `WorkspacePaths` is constructed with an already-validated absolute `runtimeRoot` from `HostConfig`.

## 5. Config: bootstrap vs runtime

### Defaults aggregation

- **Single module** e.g. `packages/host/src/config/defaults.ts` exporting **`DEFAULT_HOST_CONFIG_SEED`** (or equivalent one object).
- No scattered `17880` / `'light'` / `'.monkey-mini-app'` literals in managers, gateways, or UI.

### Two phases

1. **Bootstrap** (install / `mma init` only): may apply `DEFAULT_HOST_CONFIG_SEED` to fill unspecified fields → validate → **write** `host.json`.
2. **Runtime**: `loadHostConfig(paths)` reads file → `parseHostConfig` (schema) → **all fields required**. Missing/invalid → `HostConfigError` (fail loud). **No** `theme ?? 'light'` in runtime.

### `HostConfig` (runtime, all required)

```ts
interface HostConfig {
  runtimeRoot: AbsolutePath
  hostPort: number
  theme: ThemeId
  palette: PaletteId
  locale: LocaleId        // e.g. 'zh-CN' | 'en'
  chatLanguage: LocaleId  // v1: may equal locale
  llm: LlmConfig | null   // explicit null if unset
}
```

`createHost(platform, lifecycle, { config })` accepts **only** parsed `HostConfig`.

## 6. Seam naming (not Adapter)

Aligned with harness “name the role”:

| Contract | Owner | Implemented by |
|----------|--------|----------------|
| **`HostCapabilities`** | host consumes | dsh: bash/llm/agent/tool/mcp/credentials/config/listTools |
| **`HostLifecycle`** | host calls | dsh: `attach(ctx, services)` / `detach?` / `onHostPortChanged?` / optional `log` |
| **`PanelHost`** | panel consumes | dsh client: fetchApps, open/close, optional history/settings; locale for i18n |

```ts
interface HostCapabilities { /* ctx-facing app capabilities */ }
interface HostLifecycle {
  attach(ctx: unknown, services: HostServices): void | Promise<void>
  detach?(): void | Promise<void>
  onHostPortChanged?(port: number): void
  log?(level: LogLevel, message: string, meta?: unknown): void
}
interface PanelHost {
  fetchApps(): Promise<AppItem[]>
  openApp?(appId: AppId): void | Promise<void>
  closeApp?(appId: AppId): void | Promise<void>
  // optional capability methods → UI shows/hides controls
}
```

Dsh implementations: `DshCapabilities`, `DshLifecycle`, `DshPanelHost` (names indicative).

**Removed from required seams:** `pendingOpen` / `ackPendingOpen` — agent open flows use tools + SSE `app:open`.

## 7. HTTP vs tools

| Surface | Stack | Calls into | Must not |
|---------|--------|------------|----------|
| **HTTP** | **Hono** on Node (localhost) | `AppsManager`, `GitHistory`, compile, config | Invoke `mini_app_*` tools to serve UI |
| **Tools** | `ToolFacade` | Same managers | Curl own HTTP as a backdoor |

**Rule:** UI → HTTP; Agent → Tools; domain logic only in managers.

Hono routes live in `HttpGateway` (or equivalent class); raw `node:http` is not the primary programming model.

## 8. i18n

- Library: **i18next** (stable, lightweight enough).
- Locales v1: `zh-CN`, `en`. Catalogs colocated (e.g. `packages/host/locales/`, panel keys shared or re-exported).
- `config.locale` required at runtime (seeded in bootstrap).
- Missing key: fail in tests/dev; production may show key id — **no** silent cross-locale fallback mashup.
- Mini-app internal copy remains the app author’s responsibility.

## 9. Install vs runtime (RACI)

### Install / Bootstrap (`scripts/install-dsh-mini-app.sh` and/or `pnpm mma init`)

| Step | Done by install |
|------|-----------------|
| Build `ui` dist, build `dsh`/`host`/`panel` artifacts as needed | Yes |
| Link workspace packages into `~/.dsh/profiles/web` | Yes |
| Register bundle name `@monkey-mini-app/dsh-mini-app` in profile | Yes |
| Ensure `runtimeRoot` exists on disk | Yes |
| Write **complete** `host.json` via bootstrap + `DEFAULT_HOST_CONFIG_SEED` | Yes |
| Copy/link skills into place if profile requires external skill root | Yes (prefer package-shipped `skills/` in npm files) |
| Start `dsh web` | No (operator / docs) |

### Plugin runtime (`apply` / `Host.start`)

| Step | Done by runtime |
|------|-----------------|
| Load + **validate** `host.json` (no defaults) | Yes — fail with hint to run install/init |
| Construct `WorkspacePaths`, managers, Hono gateway, tools | Yes |
| `lifecycle.attach` — register tools, provide services, install skill hooks | Yes |
| Listen `hostPort`, emit port change | Yes |
| Create missing config / invent ports / invent roots | **No** |
| `pnpm add` into dsh profile | **No** |

### Operator mental model

```
install (once / after pull) → config on disk + profile linked
dsh web → apply loads config → host serves :port → client mounts panel
```

## 10. Engineering gates

- `strict` + no `@ts-nocheck` / ban implicit `any`.
- Coverage **≥85% lines** for `host`, `panel`, and `dsh` (client included — structure for testability; fakes for PanelHost/Platform).
- ESLint + Prettier; `no-restricted-imports` for package graph; ban `.monkey-mini-app` string outside bootstrap/defaults module.
- `pnpm typecheck`, `pnpm test`, install smoke script, `node --check` on built dsh entry.

## 11. Coding practice (normative checklist)

1. TypeScript: branded `AppId`; `assertNever`; explicit return types on exports; `any` only with `// any: reason`.
2. Imports: package names across packages; relative `.ts`; `import type`; sorted groups.
3. Naming: role suffixes; no `Adapter` on primary seams; files kebab-case matching main export.
4. Errors: `HostError` with `code`; domain throw; Hono/tools map to HTTP/tool results.
5. Async: `AbortSignal` on cancellable IO; no floating promises; idempotent `stop`.
6. Comments: JSDoc on non-obvious exports; no narrating comments.
7. Tests in `tests/`; behavior-named `it(...)`; fakes under `tests/fakes/`.
8. React: function components; domain state owned by store/host; no nocheck.
9. Config/path: only bootstrap seeds defaults; only `WorkspacePaths` joins layout.

## 12. Cutover

1. Land packages behind gates; parallel with old stack.
2. Point install script at `@monkey-mini-app/dsh-mini-app`.
3. Verify dsh web + panel + todo E2E.
4. Remove old `host-core` / `panel-core` / `dsh-plugin` and stale aliases.

## 13. Open follow-ups (non-blocking)

- Exact i18next namespace layout and whether panel bundles its own resources or imports host catalogs.
- Whether `chatLanguage` stays separate from `locale` after first ship.
- Plugin list display title if `mini-app` is unacceptable (rename npm package later).

---

## Approval

Please review this spec. Reply with changes or **approve** so we can write the implementation plan (`writing-plans`) next.
