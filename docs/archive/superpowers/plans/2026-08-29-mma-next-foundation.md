# MMA Next Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land parallel packages `@monkey-mini-app/host`, `@monkey-mini-app/panel`, `@monkey-mini-app/dsh-mini-app` with harness-aligned style, WorkspacePaths, bootstrap-only defaults, Hono HTTP, i18next, and hard gates — old packages untouched until a later cutover task.

**Architecture:** `Host` class composed via `createHost(capabilities, lifecycle, { config })`; domain managers behind Hono gateway and ToolFacade; `panel` consumes `PanelHost`; `dsh` Cordis plugin wires DshCapabilities/DshLifecycle/DshPanelHost and ships skills.

**Tech Stack:** TypeScript NodeNext (relative imports `.ts`), pnpm workspace, vitest, Hono, i18next, isomorphic-git, esbuild-wasm (UI compile), React for panel/dsh client.

**Spec:** `docs/superpowers/specs/2026-08-29-mma-next-foundation-design.md`

## Global Constraints

- Packages: `packages/host` → `@monkey-mini-app/host`; `packages/panel` → `@monkey-mini-app/panel`; `packages/dsh` → `@monkey-mini-app/dsh-mini-app`; keep `ui`.
- Seams named `HostCapabilities`, `HostLifecycle`, `PanelHost` — not Adapter.
- Relative imports use `.ts` suffix; tests in package-level `tests/`.
- No `@ts-nocheck`; no runtime `??` defaults for config/paths/ports/theme; defaults only in `config/defaults.ts` used by bootstrap.
- No `.monkey-mini-app` string outside bootstrap/defaults; all joins via `WorkspacePaths`.
- HTTP: Hono. i18n: i18next (`zh-CN`, `en`).
- Coverage ≥85% lines for host, panel, and dsh.
- Work in current dirty workspace (do not create a fresh worktree that drops WIP). Do not commit unless controller asks.
- Do not delete old `host-core` / `panel-core` / `dsh-plugin` in this plan (cutover is a final optional task or follow-up).

## File map (target)

```
packages/host/
  package.json, tsconfig.json, README.md
  src/
    index.ts
    types.ts
    errors.ts
    brand.ts                 # AppId
    config/defaults.ts       # DEFAULT_HOST_CONFIG_SEED only
    config/parse.ts          # parseHostConfig — fail loud
    config/load.ts           # loadHostConfig
    config/bootstrap.ts      # bootstrapHostConfig(input)
    paths/workspace-paths.ts
    i18n/index.ts            # i18next init + t()
    locales/zh-CN.json
    locales/en.json
    capabilities.ts          # HostCapabilities type
    lifecycle.ts             # HostLifecycle type
    host.ts                  # class Host
    create-host.ts
    apps/apps-manager.ts
    apps/manifest.ts
    git/git-history.ts
    http/http-gateway.ts     # Hono
    compile/ui-compiler.ts
    tools/tool-facade.ts
  tests/...

packages/panel/
  package.json, tsconfig.json
  src/
    index.ts, types.ts, panel-host.ts
    store.ts, actions.ts, themes.ts
    i18n.ts                  # uses keys; locale from PanelHost or props
    components/...
  tests/...

packages/dsh/
  package.json (name @monkey-mini-app/dsh-mini-app), tsconfig.json, tsup.config.ts
  src/index.ts, capabilities.ts, lifecycle.ts, panel-host.ts, skills.ts
  src/client/...
  skills/monkey-mini-app/    # migrated from dsh-plugin
  tests/...
```

---

### Task 1: Scaffold packages + workspace wiring

**Files:**
- Create: `packages/host/package.json`, `tsconfig.json`, `src/index.ts` (empty exports stub)
- Create: `packages/panel/package.json`, `tsconfig.json`, `src/index.ts`
- Create: `packages/dsh/package.json` (`@monkey-mini-app/dsh-mini-app`), `tsconfig.json`, `src/index.ts`
- Modify: root `package.json` / `pnpm-workspace.yaml` if needed (already `packages/*`)
- Modify: `tsconfig.json` / `tsconfig.base.json` paths for new packages
- Modify: `vitest.config.ts` aliases

**Interfaces:**
- Produces: installable empty packages resolving `@monkey-mini-app/host|panel|dsh-mini-app`

- [ ] **Step 1:** Create three package.json files with `"type":"module"`, correct names, deps per spec (`host`→`ui`,`hono`,`i18next`,`isomorphic-git`,`esbuild*`,`sucrase`; `panel`→`lucide-react` + peer react; `dsh`→`host`,`panel` + isomorphic-git if needed).
- [ ] **Step 2:** Add tsconfigs extending `tsconfig.base.json`, `rootDir: src`, jsx for panel/dsh client, paths.
- [ ] **Step 3:** Update root tsconfig include + base paths; `pnpm install`.
- [ ] **Step 4:** Verify `node -e "import('@monkey-mini-app/host')"` resolves (or tsc path). Smoke: `pnpm exec tsc -p packages/host --noEmit` passes on stub.

---

### Task 2: host — brands, errors, defaults, parse, WorkspacePaths

**Files:**
- Create: `packages/host/src/brand.ts`, `errors.ts`, `types.ts`, `config/defaults.ts`, `config/parse.ts`, `config/load.ts`, `config/bootstrap.ts`, `paths/workspace-paths.ts`
- Test: `packages/host/tests/config.test.ts`, `packages/host/tests/workspace-paths.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_HOST_CONFIG_SEED`
  - `parseHostConfig(raw: unknown): HostConfig` — throws `HostConfigError`
  - `bootstrapHostConfig(input: HostConfigInitInput): HostConfig`
  - `loadHostConfig(paths: WorkspacePaths): HostConfig`
  - `class WorkspacePaths { constructor(root: AbsolutePath); appDir(id: AppId): AbsolutePath; ... }`

- [ ] **Step 1:** Write failing tests: parse rejects missing `runtimeRoot`; bootstrap fills theme/locale from seed; `WorkspacePaths.appDir` joins `apps/<id>`; grep-style test that defaults module is the only place with `.monkey-mini-app` string in host/src.
- [ ] **Step 2:** Implement until tests pass.
- [ ] **Step 3:** Export from `src/index.ts`.

---

### Task 3: host — i18n (i18next)

**Files:**
- Create: `packages/host/src/i18n/index.ts`, `locales/zh-CN.json`, `locales/en.json`
- Test: `packages/host/tests/i18n.test.ts`

**Interfaces:**
- Produces: `createHostI18n(locale: LocaleId)`, `t(key, params?)` bound to locale; missing key throws in test env.

- [ ] **Step 1:** Failing test for `t('config.missingHint')` in zh-CN.
- [ ] **Step 2:** Implement i18next resources; export helper.
- [ ] **Step 3:** Pass tests.

---

### Task 4: host — HostCapabilities / HostLifecycle types + Host skeleton

**Files:**
- Create: `packages/host/src/capabilities.ts`, `lifecycle.ts`, `host.ts`, `create-host.ts`
- Test: `packages/host/tests/host-lifecycle.test.ts`

**Interfaces:**
- Consumes: `HostConfig`, `WorkspacePaths`
- Produces:
```ts
class Host {
  constructor(
    private readonly capabilities: HostCapabilities,
    private readonly lifecycle: HostLifecycle,
    private readonly paths: WorkspacePaths,
    private readonly config: HostConfig,
    // managers injected as created by createHost
  )
  apply(ctx?: unknown): Promise<{ port: number }>
  start(): Promise<{ port: number }>
  stop(): Promise<void>
  get port(): number
}
function createHost(
  capabilities: HostCapabilities,
  lifecycle: HostLifecycle,
  options: { config: HostConfig },
): Host
```
- Fake lifecycle/capabilities in tests; `start` without Hono yet may bind a noop server or defer listen to Task 5 — prefer Task 4 only constructs and calls `lifecycle.attach` with empty services stub.

- [ ] **Step 1:** Failing test: `createHost` throws if config invalid (use parse); `apply` calls `lifecycle.attach`.
- [ ] **Step 2:** Implement skeleton Host + createHost (managers can be stubs).
- [ ] **Step 3:** Pass tests.

---

### Task 5: host — AppsManager + GitHistory + ToolFacade (domain)

**Files:**
- Create: `packages/host/src/apps/apps-manager.ts`, `apps/manifest.ts`, `git/git-history.ts`, `tools/tool-facade.ts`
- Test: `packages/host/tests/apps-manager.test.ts`, `git-history.test.ts`, `tool-facade.test.ts`

**Interfaces:**
- Produces AppsManager list/load/call/register/remove using WorkspacePaths; GitHistory via isomorphic-git only; ToolFacade exposing `mini_app_*` definitions calling AppsManager.
- Port behavior from current `host-core` where correct; do not copy nocheck/any soup — type properly.

- [ ] **Step 1:** Write tests with temp dirs from bootstrapHostConfig.
- [ ] **Step 2:** Implement managers.
- [ ] **Step 3:** Wire into `createHost`.
- [ ] **Step 4:** Pass tests.

---

### Task 6: host — Hono HttpGateway + UiCompiler

**Files:**
- Create: `packages/host/src/http/http-gateway.ts`, `compile/ui-compiler.ts`, `runner` html helper as needed
- Test: `packages/host/tests/http-gateway.test.ts` (supertest or fetch against started Host)

**Interfaces:**
- Routes (minimum): `GET /api/apps`, `POST /api/call`, `GET /api/host-config`, `GET /app/:appId`, UI compile endpoints as needed for panel.
- Host.start listens with Hono/node adapter on `config.hostPort` (port `0` allowed in tests).

- [ ] **Step 1:** Failing test: start host, GET `/api/apps` → 200 JSON.
- [ ] **Step 2:** Implement gateway; integrate start/stop.
- [ ] **Step 3:** Port compile-ui from host-core carefully; test compile or skip heavy wasm with unit seam if needed — at least one smoke compile test.
- [ ] **Step 4:** Pass tests; ensure HTTP does not call ToolFacade.invoke.

---

### Task 7: panel package

**Files:**
- Create panel sources: `panel-host.ts`, store, actions, themes, components (port from panel-core, clean types)
- Test: `packages/panel/tests/store.test.ts`, `themes.test.ts`, smoke mount with fake PanelHost

**Interfaces:**
- Produces: `createMiniAppPanel(host: PanelHost)`, mount/open/close API matching current consumers enough for dsh client.

- [ ] **Step 1:** Fake PanelHost tests for store/actions.
- [ ] **Step 2:** Port UI components without `/api` strings.
- [ ] **Step 3:** i18n keys via host catalogs or panel resources + i18next.
- [ ] **Step 4:** Pass tests.

---

### Task 8: dsh package — plugin + skills + client

**Files:**
- Create: `packages/dsh/src/index.ts` (`name`, `inject`, `apply`), `capabilities.ts`, `lifecycle.ts`, `panel-host.ts`, `skills.ts`, `client/*`, `tsup.config.ts`
- Copy: `skills/monkey-mini-app/**` from `packages/dsh-plugin/skills`
- Test: `packages/dsh/tests/apply-config.test.ts` (apply throws without host.json), `capabilities.test.ts`, client unit tests for pure helpers
- Create: `scripts/install-dsh-mini-app.sh` (from install-dsh-plugin.sh, point to new package)
- Create: `scripts/mma-init.ts` or embed bootstrap in install script

**Interfaces:**
- `apply`: loadHostConfig → createHost(DshCapabilities, DshLifecycle, { config }) → host.apply(ctx)
- Missing config → throw with i18n hint
- Client: build `DshPanelHost`, `createMiniAppPanel`

- [ ] **Step 1:** Tests for fail-loud apply; skills path resolves under package.
- [ ] **Step 2:** Implement plugin + migrate skills.
- [ ] **Step 3:** Client without `@ts-nocheck`; extract pure functions for coverage.
- [ ] **Step 4:** tsup build; `node --check lib/index.js` + client.
- [ ] **Step 5:** Install script writes bootstrap config + links packages.

---

### Task 9: Gates — eslint boundaries, coverage thresholds, docs

**Files:**
- Create/modify: eslint config (ban `.monkey-mini-app` outside defaults/bootstrap; restrict imports host↛panel)
- Modify: vitest coverage thresholds for new packages ≥85%
- Modify: `AGENTS.md` — document new packages + install script; mark old as legacy parallel
- Test: run `pnpm test`, coverage on host/panel/dsh

- [ ] **Step 1:** Add eslint rules; fix violations.
- [ ] **Step 2:** Raise coverage until ≥85% each new package (add tests as needed).
- [ ] **Step 3:** Update AGENTS.md / host-architecture pointer to new spec.
- [ ] **Step 4:** Manual smoke: `bash scripts/install-dsh-mini-app.sh`, restart dsh web, curl `/api/apps`, open 小程序 (document results in report).

---

### Task 10 (optional follow-up, not required to close foundation): Cutover delete old packages

Only after Task 9 smoke green and user confirms: remove `host-core`, `panel-core`, `dsh-plugin`, switch default install fully, delete dead aliases.

---

## Self-review

- Spec § paths/config/seams/Hono/i18next/install RACI/gates → Tasks 2–9.
- Naming HostCapabilities/Lifecycle/PanelHost → Task 4/7/8.
- Coverage all three packages → Task 9.
- No old package deletion required before foundation smoke → Task 10 optional.
