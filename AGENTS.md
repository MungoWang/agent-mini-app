# AGENTS.md

For **Grok CLI / other coding agents**.

The **product is the mini-app platform** (`host` / `panel` / `sdk`). dsh is the shipped host adapter; pi is not implemented (`docs/rfcs/pi-extension-port.md`). Do not write dsh as the only product.

1. Read **[`docs/README.md`](docs/README.md)** first (doc rules + index).
2. Code map below; generating mini-apps: skill `skills/monkey-mini-app/` (platform; adapters copy on pack).

Web Grok sandbox ≠ this repo. Platform UI: `pnpm dev:host`. dsh adapter: edit files here → `pnpm --filter @monkey-mini-app/dsh-mini-app build` → restart dsh web → hard-refresh.

## Doc rules

- **Language: developer-facing text is English by default.** Applies to `docs/**`, `README.md`, code comments, JSDoc, commit/PR text, and the skill (`skills/monkey-mini-app/**`).
 - **Keep the two languages apart by audience, not by file type:** *instructions* (what a reader/agent must do) are always English; *sample product copy* (strings a mini-app renders — template `ui.tsx` labels, `manifest.name`, error text shown to the end user) follows the host locale and stays Chinese in the samples.
 - Customer-facing `README.md` may have a `README.zh.md` twin. **When you change one, change the other in the same commit** — an out-of-date translation is a bug, not a TODO.
 - Personal / working notes (`TODO.md`, `LOCAL.md`, scratch RFCs) may stay Chinese if that is faster for the author; anything published or read by agents should be English.
- Architecture → `docs/architecture/`; contracts → `docs/contracts/`; unshipped research → `docs/rfcs/`.
- **Do not** add long essays at repo root or `docs/` root (`docs/README.md` excepted).
- `docs/archive/**` is read-only; not an implementation source.
- Skill contract source of truth: `skills/monkey-mini-app/` (not an npm package; `scripts/gen/skill/copy.mjs` copies into adapters on pack).
- `references/catalog.md` + `references/contracts/**` are **generated** — never hand-edit; add JSDoc `@when` / `@example` on the component instead, then `pnpm gen:skill`. `pnpm check:skill` fails on legacy UI specifiers, invented `ctx.*` / `mini_app_*` names, inherited-prop dumps, and broken tables.

## Where to edit

| Goal | Path |
|------|------|
| Platform host (AppsManager / Git / Hono / UI compile / tools) | `packages/host/src/` |
| Platform panel (`PanelHost`, host-agnostic) | `packages/panel/src/` |
| Mini-app UI author package | `packages/ui/` → `pnpm build:ui` + `pnpm build:sdk` (iframe) |
| Mini-app backend contract | `packages/api/` → `pnpm build:api` |
| UI kit | `packages/ui/` → `pnpm build:ui` (+ `pnpm build:sdk` iframe) |
| Runnable examples (gallery · e2e · skill) | `packages/ui-examples/` → `pnpm gen:skill` + `pnpm gen:examples` |
| dsh adapter (plugin + client + skills) | `packages/dsh/` (npm: `@monkey-mini-app/dsh-mini-app`) |
| Mini-app authoring skill (platform) | `skills/monkey-mini-app/` |
| UI skill contracts (generated) | `scripts/gen/skill/` → `pnpm gen:skill`; gate `scripts/check/skill.mjs` → `pnpm check:skill` (see `scripts/README.md`) |
| Host-free demo | `pnpm dev:host`; gallery `apps/demo-host/` |
| dsh path-link on a dev machine | `scripts/setup/install-dsh-plugin.sh` |
| pi adapter | **not implemented**; `docs/rfcs/pi-extension-port.md` |
| Live architecture | `docs/architecture/overview.md` |

`packages/dsh/lib/` is tsup output (gitignored).

## Architecture

- Composition root: `createHost(capabilities, lifecycle, { config }).apply(ctx)`. dsh passes `DshCapabilities` / `DshLifecycle`; a new host implements its own. Do not leak dsh types into `host` / `panel` / `sdk`.
- Seam names: `HostCapabilities` / `HostLifecycle` / `PanelHost` (do not add an `Adapter` primary seam).
- `HostCapabilities.*(callCtx, …)`; `bindCapsToContext` → author `ctx.*`; opts are not merged.
- Paths only via `WorkspacePaths`; product code must not hardcode `~/.monkey-mini-app`.
- Config: first plugin boot `bootstrapHostConfig` writes a full `host.json` if missing; a present-but-corrupt file fails loud.
- git: `isomorphic-git` in `packages/host/src/git/`; no `child_process` git CLI.
- UI: host compiles instance `ui.tsx` to ESM; `react` → `/mma/runtime.js`, SDK → `/mma/sdk.js`. No compile inside the iframe.
- Old packages deleted; snapshot tag: `archive/pre-cutover-legacy-2026-08-29`.

## Hard constraints (broken apps if violated)

1. UI imports `@monkey-mini-app/ui` (+ `react`); backend imports `@monkey-mini-app/api` (`defineApp`). UI may not import `main.api.ts`, `api/**`, or any other npm package. Hooks from `react`; components and `useApp()` from the UI package. Compiler: `react` → `/mma/runtime.js`, UI kit → `/mma/sdk.js`; relative imports that leave the app dir fail. Legacy `@monkey-mini-app/ui` / `@monkeyagent/*` are **removed**.
 - Icons: `import { Icon } from "@monkey-mini-app/ui"` then `<Icon.HelpCircle />`.
 - Illustrations: `IlluXxx` from the SDK (unDraw, MIT; `scripts/gen/illustrations.mjs` tokenizes accent→`--primary`, greys→`--muted`/`--card`). No hard-coded hex. Accent via `--primary-svg-color: var(--primary)`.
2. `call` methods must be keys of `defineApp({ api })`.
3. Backend `main.api.ts` imports `defineApp` from `@monkey-mini-app/api` (the host injects the runtime copy — nothing React is loaded) + relative paths inside the app dir; no npm / Node builtins / `ui/**`. Layout: `ui/` UI-only · `api/` backend-only · `shared/` pure-isomorphic (enforced both ways). Net: `ctx.http`; machine: `ctx.bash`; model: `ctx.llm`.
4. `compileAppSource` uses sucrase; no regex global strip of `: type`. UI compile: `packages/host/src/compile/ui-compiler.ts`.
5. `ctx.llm` goes through `HostCapabilities.llm`; only the dsh adapter uses `llm.stream({ provider, model, messages })`. Do not hardcode dsh in `host`.
6. `ctx.http` → `{ ok, status, headers, text, json }`; `ctx.bash` → `{ stdout, stderr, exitCode }`; `ctx.llm` / `ctx.tool` → **string**. MCP args must not be `{ input: "..." }`.
7. iframe must fill height; `#root.boot` is load art only — clear it before React mount.
8. Mini-app entry shares collapse classes with Settings; open via `data-mma-open` event delegation.
9. UI kit dist `index.js` must be a flat named re-export; after rename re-run `node scripts/build/ui.mjs` then `node scripts/build/sdk.mjs`.
10. Deps esbuild-wasm cannot bundle must be external (dsh adapter `tsup.config.ts`; other hosts the same).
11. Runtime does not invent missing `host.json` fields; first boot bootstraps a **missing** file; a **present-but-corrupt** file fails loud.
12. Heavy editors load from CDN on demand (`esm.sh`), **not** npm peers: `CodeEditor` → CodeMirror 6; `CodeBlock` / `DiffViewer` → shiki. `RichTextEditor` is local contentEditable (no TipTap/CDN). Do not `import` CM/shiki packages in mini-apps; do not load a second React (`@uiw/react-codemirror` `+esm`). On CDN failure CM/shiki degrade (textarea / no highlight) — users must not `pnpm add` them.

## UI kit i18n (required for new/changed components)

`packages/ui` chrome strings (toolbar labels, empty states, aria-labels, relative time) **must** go through `useLabels("…")` + keys in `packages/ui/src/i18n/en.ts` **and** `zh.ts`. Do not hardcode user-facing English in products/blocks/composites.

- Add both `en` and `zh` in the same change; `UiMessages` is inferred from `en`.
- Prefer `useDateLocale()` for `toLocaleDateString` / `toLocaleTimeString` instead of hardcoded `"en-US"`.
- Technical tokens may stay English (log level abbreviations `ERR`/`WRN`, env keys, commit hashes).
- When porting third-party UI, strip their hardcoded chrome and rewire to `useLabels` before merging.
- After adding keys: rebuild is not enough for authors — keep skill contracts via `pnpm gen:skill` when public props change.

## Style (eslint, autofix)

`packages/host|panel|api|dsh` (`packages/ui` is linted for **invariants only** — no style rules; see the comment in `eslint.config.js`):

- Double quotes + semicolons
- `import type { … }` split from value imports
- Import groups: `node:` → externals → `@monkey-*` → relative

```bash
pnpm lint:fix
pnpm lint
```

## Dev vs publish

**Dev (not in the publish pipeline):** `pnpm test` / `test:coverage` / `lint` / `lint:fix` / `typecheck` / `build` / `build:ui` / `gen:skill` / `smoke`. `scripts/gen/illustrations.mjs` only when changing illustration sources — **never in publish**.

**Publish:**
- `pnpm publish:packages` (`scripts/release/publish.mts`): `pnpm test:dsh` first (Verdaccio + real dsh web), then npm publish ui → sdk → host → panel → dsh. Emergency skip: `--skip-e2e`.
- `apps/dsh-host` is its **own pnpm workspace** (`pnpm-workspace.yaml` + lockfile there): the dsh plugin tree needs isolated linking so each plugin resolves its own peer copy — under the root's hoisted install `dsh web` cannot boot. `pnpm test:dsh` installs it first; a root `pnpm install` alone is not enough. Keep dsh on exact pins, one train across `dsh` / `dsh-llm` / `dsh-session` / `dsh-subagent` (never `latest`).
- Package hooks: ui `prepack` → build-ui; sdk `prepack` → runtime/sdk.js; host `prepack` → tsup `dist/`; dsh `prepublishOnly` → ui+sdk + `gen:skill` + tsup (**no** `prepare`; `dsh plugin add` does not compile on the user machine).

## Gates

Repo automation lives under `scripts/` by lifecycle stage — see [`scripts/README.md`](scripts/README.md).


Examples must stay mini-app-portable (`react` + bare `@monkey-mini-app/ui` + relatives):
the eslint gate in `packages/ui-examples` enforces it, prettier formatting is checked by
`pnpm check:format`. After touching examples run `pnpm gen:skill && pnpm gen:examples`.

```bash
pnpm verify          # preferred after refactor: build + skill + templates + lint + tsc + test + dsh build
# or piece-wise:
pnpm lint
pnpm skill           # gen:skill + check:skill
pnpm check:templates
pnpm test
pnpm test:coverage   # host/panel/dsh lines ≥85% (also: pnpm verify:coverage)
pnpm typecheck       # every tsconfig in the repo (root aggregate + each package's own)
pnpm --filter @monkey-mini-app/dsh-mini-app build
```

`pnpm typecheck` runs the root aggregate **and every `packages/<name>/tsconfig.json`**, each with its own options. That is deliberate: an editor's TS server loads the *nearest* config, so a bare `tsc -b` can be green while the file you are looking at is red — it had missed a missing `DOM` lib in `host`, 64 × ts(6059) in `dsh` (inferred `rootDir` vs base `paths` → sibling source), and `packages/ui`, which was in no CI config at all. Adding a package with a `tsconfig.json` is picked up automatically; do not replace the walk with a hand-kept list.

Every package config includes `src` **and** `tests`. **Do not** put `**/*.test.ts` in exclude: orphan tests fall into an inferred (non-strict) project — IDE red, CI green. Before claiming types are clean, run `pnpm typecheck` (not `tsc -b` alone). `packages/ui` is linted for **invariants only** (no style rules) — see `eslint.config.js` for why.

## Verify

```bash
node --check packages/dsh/lib/index.js
node --check packages/dsh/lib/client.js
curl -s http://127.0.0.1:17880/api/apps
```

Open `小程序` (the mini-app panel): list, open Todo, collapse rail, dock right, content not a slit.

## New mini-app

Follow the skill: `manifest.json` + `ui.tsx` + `main.api.ts` (+ `ui/` `api/` `shared/`). UI: `@monkey-mini-app/ui`; backend: `@monkey-mini-app/api`. Samples: skill `templates/`.

When changing protocol, update `docs/contracts/` and the skill.
