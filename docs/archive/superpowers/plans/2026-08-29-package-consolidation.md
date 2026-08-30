# Package Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse over-split single-file packages into `host-core` + `dsh-plugin`, delete dead packages (`tauri`, `adapter-dsh`), leave a clear 5-package product surface.

**Architecture:** Move source files into `host-core/src/` (and skill helpers into `dsh-plugin`), rewrite imports to `@monkey-mini-app/host-core`, delete emptied packages, clean aliases/lockfile/docs. No compatibility re-exports for old package names.

**Tech Stack:** pnpm workspace, TypeScript NodeNext, vitest, tsup (dsh-plugin bundle).

**Spec:** `docs/superpowers/specs/2026-08-29-package-consolidation.md`

**Global Constraints:**
- Work in the current dirty workspace (do not create a fresh worktree — uncommitted `createHost` WIP would be lost).
- Keep `panel-core` and `ui` as separate packages.
- **Git is one stack:** all product git read/write uses `isomorphic-git` only — rewrite CLI `host-core/git.ts` into the same module as HistoryPort (no `execFile("git", …)` in product or git-helper tests).
- After each task: affected package tests pass; after Task 5: full `pnpm test` + dsh-plugin build.
- Do not commit unless the controller asks; leave a coherent working tree.

---

### Task 1: Delete dead packages + retarget smoke

**Files:**
- Delete: `packages/tauri-integration/` (entire)
- Delete: `packages/adapter-dsh/` (entire)
- Modify: `packages/smoke-test/package.json` — drop deps on deleted packages
- Modify: `packages/smoke-test/samples-headless.test.ts` — remove `adapter-dsh` / rewrite to host-core or drop obsolete cases
- Modify: `packages/smoke-test/smoke.test.ts` — import from paths that still exist (will be updated again in Task 4); for now keep runtime-core imports
- Modify: `vitest.workspace.ts`, `vitest.config.ts` — remove `adapter-dsh` alias
- Modify: `AGENTS.md`, `docs/host-architecture.md`, READMEs that mention tauri-integration / adapter-dsh as live packages — mark removed or delete sections
- Delete: any `packages/tauri-integration` references in root docs

**Interfaces:**
- Produces: workspace without tauri / adapter-dsh packages

- [ ] **Step 1:** Delete `packages/tauri-integration` and `packages/adapter-dsh` directories.
- [ ] **Step 2:** Update smoke-test: remove `createDshAdapter` tests or rewrite against `@monkey-mini-app/host-core` `createHost` + a minimal mock adapter. Keep `getHelloTemplateFiles` temporarily (agent-skills still exists until Task 3).
- [ ] **Step 3:** Remove aliases for `adapter-dsh` from vitest configs.
- [ ] **Step 4:** `pnpm install` at repo root; run `pnpm --filter @monkey-mini-app/smoke-test test` (or vitest path). Fix failures.
- [ ] **Step 5:** Grep for `tauri-integration` and `adapter-dsh` under `packages/` and `apps/` — zero remaining code imports.

---

### Task 2: Fold thin packages into host-core / dsh-plugin (skills, ui-state, themes, drop app-history)

**Files:**
- Create: `packages/host-core/src/runtime/themes-builtin.ts` — merge theme-light + theme-dark exports (`id`, `label`, `getTokens` for light and dark)
- Create: `packages/host-core/src/ui-state.ts` — move `packages/ui-core/src/index.ts` content; import types from upcoming ports or keep `@monkey-mini-app/host-port` until Task 3
- Create: `packages/dsh-plugin/src/skills.ts` — move `packages/agent-skills/src/index.ts`; fix `resolveSkillDir` candidates to prefer `../skills/monkey-mini-app` from dsh-plugin src/lib
- Modify: all callers of `createHistory` to use the git adapter directly (or `const history = createGitHistoryAdapter()`)
- Delete packages after callers updated: `theme-light`, `theme-dark`, `ui-core`, `agent-skills`, `app-history`
- Move ui-core tests → `packages/host-core/src/ui-state.test.ts`
- Update `dsh-plugin` imports: `getSkillDir` from `./skills.js`; `createUiCore` from `@monkey-mini-app/host-core`
- Export new symbols from `packages/host-core/src/index.ts`

**Interfaces:**
- Produces: `createUiCore`, builtin theme modules from host-core; `getSkillDir`/`getSkillMarkdown`/`getTemplateFiles`/`getHelloTemplateFiles` from dsh-plugin `./skills.js`
- Removes: `createHistory` — callers assign adapter as `HistoryPort`

- [ ] **Step 1:** Add themes-builtin, ui-state, dsh skills modules; export from host-core index.
- [ ] **Step 2:** Replace imports across repo; eliminate `createHistory` wrapper usages.
- [ ] **Step 3:** Delete emptied packages; update package.json deps; `pnpm install`.
- [ ] **Step 4:** Run host-core + dsh-plugin + smoke tests that touch these symbols.

---

### Task 3: Move ports + bridge + api-client into host-core

**Files:**
- Create: `packages/host-core/src/ports.ts` ← `host-port/src/index.ts`
- Create: `packages/host-core/src/bridge/protocol.ts` ← `bridge-protocol`
- Create: `packages/host-core/src/bridge/client.ts` ← `api-client` (import protocol relatively)
- Move tests alongside
- Update every import of `@monkey-mini-app/host-port|bridge-protocol|api-client` → `@monkey-mini-app/host-core` or relative
- Delete: `packages/host-port`, `packages/bridge-protocol`, `packages/api-client`
- Export from host-core `index.ts`

- [ ] **Step 1:** Copy sources + tests into host-core; fix relative imports.
- [ ] **Step 2:** Rewrite consumers (runtime-core still external until Task 4 — update it to import from host-core).
- [ ] **Step 3:** Delete old packages; clean aliases; `pnpm install`; run moved tests.

---

### Task 4: Move runtime-core, adapter-node, app-history-git, agent-core into host-core

**Files:**
- Create: `packages/host-core/src/runtime/{index,bridge-hub,storage}.ts` (+ tests)
- Create: `packages/host-core/src/node-fs.ts` (+ test)
- Extend: `packages/host-core/src/git.ts` — fold `createGitHistoryAdapter` (HistoryPort) into the same isomorphic-git module as read helpers (+ move app-history-git tests)
- Create: `packages/host-core/src/agent-handlers.ts` (+ test)
- Modify: `host-core/src/host.ts`, `tools.ts` — relative imports
- Modify: `host-core/package.json` — drop workspace deps on absorbed packages; add `isomorphic-git` if needed; keep panel-core, ui, esbuild*, sucrase, pinyin-pro
- Delete: `packages/runtime-core`, `adapter-node`, `app-history-git`, `agent-core`
- Update: smoke-test, vitest aliases, tsconfig.base paths, dsh-plugin tsup aliases (remove absorbed packages; depend only on host-core/panel-core/ui)
- Update: `AGENTS.md`, `docs/host-architecture.md`, `docs/context.md` package map to the 5-package model
- Modify: `packages/host-core/src/index.ts` — export public API used by dsh-plugin and smoke

**Interfaces:**
- Produces: single `@monkey-mini-app/host-core` for `createRuntime`, `createNodeHostPort`, `createGitHistoryAdapter`, `createAgentHandlers`, `createMiniClient`, ports types, etc.

- [ ] **Step 1:** Physically move files; fix all relative imports inside host-core.
- [ ] **Step 2:** Update external consumers + tsup/vitest/tsconfig.
- [ ] **Step 3:** Delete old package dirs; `pnpm install`.
- [ ] **Step 4:** Run `pnpm test` and `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build` + `node --check` on lib outputs.

---

### Task 5: Docs polish + final verification

**Files:**
- `AGENTS.md` — rewrite「改哪里」/架构 table for 5 packages
- `docs/host-architecture.md` — remove references to absorbed package names as packages
- `docs/context.md` — short note on package surface
- Root `monkey-mini-app-design.md` / `docs/DESIGN.md` — add a one-line deprecation note at top pointing to new architecture (do not rewrite entire historical design)
- Grep entire repo for deleted package names in code/config (docs historical mentions OK if labeled obsolete)

- [ ] **Step 1:** Update living docs (AGENTS, host-architecture, context).
- [ ] **Step 2:** Full `pnpm test`; dsh-plugin build; node --check.
- [ ] **Step 3:** Confirm `packages/` only contains: `dsh-plugin`, `host-core`, `panel-core`, `ui`, `smoke-test` (and any intentional leftovers like empty dirs cleaned).

---

## Self-review

- Spec coverage: delete list, fold list, layout, import rule, verification — all tasked.
- No compatibility shims — explicit.
- git.ts vs history-git preserved — Task 4 constraint.
