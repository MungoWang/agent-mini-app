# RFC: Authoring surface — utils, motion, layouts, templates, security, theme

> Date: 2026-09-05
> Status: **partly shipped** — (4) README intent ✅ · (5) custom-theme contract + skill ✅ ·
> (1a) lodash vendor ✅ · (1b) `motion` vendor + kit `Reveal` ✅ · (2) layout presets ✅ (all six,
> 2026-09-10 — [`layout-presets-2026-09-10.md`](../archive/tasks/layout-presets-2026-09-10.md)) ·
> (3) templates/paradigms **superseded** by
> [`looks-and-templates.md`](../architecture/looks-and-templates.md) (shipped; does not wait on remaining presets)
> Source: items 1–5 of [`rough-ideas.md`](./rough-ideas.md)
> Packages: `packages/ui` · `packages/api` · `packages/host` · `packages/panel` · skill / templates / README
> Related: [`TODO.md`](../../TODO.md) P1-4 (theme table, landed) · P1-5 (animation, **landed** — shipped as its own iframe vendor, see §3.1) · [`rfcs/authoring-protocol.md`](./authoring-protocol.md)

## 0. Verdict

**Do all five, as one proposal, not as one PR, and not as written.**

They are the same product gap — the authoring surface an agent actually touches — so they belong in one RFC. They are not the same change: (1)(2) mutate the kit and the iframe bundle, (3) rewrites the samples that *demonstrate* (1)(2), (4) is honesty about the trust model, (5) is mostly generator + guide on top of work that already landed.

| # | Idea | Do? | Shape |
|---|---|---|---|
| 1 | Utils + motion, LLM-familiar, preferably one package for UI and API | **Yes** | **Full lodash** (not a subset, not a home-grown `mma.utils`) as a platform module on both sides, same as React: complete, not curated. `motion` bundled for the iframe. Do **not** merge `@monkey-mini-app/ui` and `@monkey-mini-app/api`. |
| 2 | Layout presets in the kit | **Yes, with a cut** | Page-level slot presets that encode the CSS agents get wrong. Not `Stack` / `Box` / `Text` (already rejected in `references/styling.md`). |
| 3 | Templates + paradigms | **Yes, last** | One hello-world (`minimal`). Every other template must earn its tokens with a unique capability × layout identity. Paradigms get a professional visual pass. |
| 4 | Project-level intent + boundary (not a runtime fence) | **Yes, docs first** | README states: this is owner-operated local software; mini-apps run as the host. **No sandbox in the runtime.** A fence is only in scope if/when we ship **shared packages**, and it applies to those packages — not to apps the owner just generated. |
| 5 | Guide agents to build a **global** custom theme; token keys generated, not handwritten | **Yes** | Runtime already loads `themes/theme-<id>.css`. Missing is the skill recipe (when the user wants one: where to write, file contract, light/dark pairing). Do **not** treat this as "enable the disabled Settings control". |

Leave in `rough-ideas.md` (out of scope here): skill NL→PRD workflow, Tauri / pi-desktop shell, generation-efficiency measurement.

## 1. Why these five are one RFC

An agent writing a mini-app today hits the same wall from five sides:

1. It cannot `import` anything except `@monkey-mini-app/ui` + `react` (UI) or `@monkey-mini-app/api` (backend). Familiar libraries (`lodash`, `motion`, `date-fns`, `zod`) are either missing or exist only as *kit internals*, so the model spends tokens reinventing `groupBy` / `uniqBy` / `debounce`.
2. Layout is "Tailwind on a `div`". `AppShell` / `PageHeader` / `DetailPanel` exist, but the hard page shapes (list-detail that actually scrolls, dashboard with a KPI row, settings with a side nav) are re-invented per app, usually wrong (`min-h-0`, `overflow`, sticky headers).
3. Seven templates and nine paradigms overlap visually. Each extra similar sample is paid for on every generation.
4. README sells `ctx.bash` / `ctx.http` / `ctx.llm` as the point, but never says the matching boundary: this is owner-operated, not a cloud sandbox. That is a product claim, not a missing `ctx.bash` jail.
5. Custom themes already work as host-level CSS files, but the skill never tells an agent to write one. When the user wants a named palette, the model either hardcodes hex in the app (breaks dark mode) or does nothing.

Doing (3) before (1)(2) just rewrites samples that will be rewritten again. Doing (1) without (3) ships a kit nobody demonstrates. (4) and (5) are independent of the kit and can land first.

## 2. Evidence (what is already true)

### 2.1 Utils / motion

- `packages/ui/src/lib/utils.ts` already exports `cn` (`clsx` + `tailwind-merge`) and `index.ts` re-exports it. Authors *can* `import { cn } from "@monkey-mini-app/ui"` today; the skill barely teaches it.
- `date-fns`, `zod`, `class-variance-authority` are UI dependencies. None of them are on the author surface. `date-fns` is used inside pickers/calendar only.
- Animation today: `tw-animate-css` (`animate-in` / `fade-in` / `slide-in-from-*`). `references/styling.md` already says "a motion library is being decided… do not inject `@keyframes`". `TODO.md` P1-5 parked this waiting for `motion`.
- Paradigm demos already invented `Reveal` + `useCountUp` in `examples/paradigms/shared.tsx` with a comment *"promote to the kit later"*. That is the demand signal.
- Backend loader (`packages/host/src/apps/apps-manager.ts`) injects **only** `defineApp` from `@monkey-mini-app/api`. Any other name on that specifier throws `BACKEND_IMPORT`. Bare npm specifiers are illegal on both sides except the iframe platform pair: `react` / `react-dom` → `/mma/runtime.js` (**complete, not curated**), `@monkey-mini-app/ui` → `/mma/sdk.js`. That is the pattern lodash should copy.
- There is no author-facing util library. Agents hand-write the same 8-line `groupBy` / `keyBy` / `uniqBy` / `pick` / `debounce` helpers in `shared/` every app.

### 2.2 Layouts

`@family Layout & structure` currently: `AppShell` (optional sidebar + header + main), `PageHeader`, plus primitives (`Sidebar`, `Resizable`, `ScrollArea`, `Separator`). Adjacent: `FilterBar`, `DetailPanel` (a `Sheet`), `Stepper`, `Kanban`.

`references/styling.md`:

> There is no `Stack` / `Text` / `Box` component — layout is Tailwind classes.

That rejection stands. The gap is **page presets**, not a layout engine.

### 2.3 Templates / paradigms

| Template | Lines (ui+api) | Claimed axis |
|---|---:|---|
| `minimal` | 99 | skeleton + one `call` |
| `todo` | 260 | `ctx.storage` CRUD + filter |
| `insights` | 252 | `http` + `llm` + cancel/progress |
| `monitor` | 267 | `system.metrics` + charts |
| `review` | 228 | Diff / CodeEditor / DataGrid |
| `agentrun` | 270 | `ctx.agent` + SSE |
| `jira` | 433 | Kanban + DataGrid + Sheet + llm |

The table in `templates/README.md` already describes distinct axes. The files do not always *look* distinct — several are a card list + a header + a primary button. `jira/ui.tsx` at 318 lines is the token-cost warning the README already gives.

Paradigms (`packages/ui-examples/src/paradigms/`, copied into the skill): nine visual skins (saas / ops / darkdata / desk / editorial / glass / minimal / semantic / terminal). They are style recipes, not app templates — that split is right. Quality is uneven; several are the same dashboard recast.

### 2.4 Security

- `ctx.bash` on dsh is `execFile("bash", ["-c", command], { env: process.env, timeout: 120_000, maxBuffer: 8MB })`. No cwd jail, no argv allowlist, full user environment.
- `ctx.http` is the host's network. `ctx.llm` / `ctx.agent` spend the host's model budget. `ctx.storage` is files under the app runtime dir.
- Mini-app iframe (`packages/panel/src/frame.ts`): `allow="clipboard-write"`, **no `sandbox` attribute**. Served by the host origin, embedded on the panel origin → cross-origin vs the panel (parent cannot read the DOM), **same-origin with host HTTP** (required for `POST /api/app/:id/errors` and view-eval).
- `sandbox="allow-scripts allow-same-origin"` is not a security boundary (the pair can escape). Adding a real sandbox would break the diagnostic loop unless we redesign it.
- README.md / README.zh.md: no trust model, no disclaimer.

The iframe isolates the *panel* from a broken React tree. It does **not** isolate the machine from a generated `main.api.ts`.

### 2.5 Theme (custom files already work)

- App-facing token table: generated. `scripts/gen/skill/theme.mjs` reads `packages/ui/src/styles/globals.css` → `references/theme.md`. That is P1-4, done. Those names (`--background`, `--primary-foreground`) are what **mini-apps** write.
- Builtins: eight palettes in `packages/panel/src/themes.ts`, shown in ThemePop.
- **Custom themes are live today**, not a stub:
  - Files: `<dirname(runtimeRoot)>/themes/theme-<id>.css` (default runtime `~/.monkey-mini-app/runtime` → `~/.monkey-mini-app/themes/`). Skill must derive the dir from `runtimeRoot` (`mini_app_list` already returns it), never hardcode the home path in product code.
  - Contract (`parseThemeCss` in `packages/panel/src/themes.ts`): one file, **both** `:root[data-mode="light"]` and `dark`; header `/* name: … */`; keys are the **short** TokenSet names (`--bg`, `--fg`, `--primary-fg`, …) — **not** the app tokens. Missing `bg` / `fg` / `primary` in either mode → file ignored.
  - Loader: `DshThemeResource.listCustomPalettes` scans `theme-*.css` on every call; `GET /api/palettes`; ThemePop already renders them with a 「自定义」 badge. `runnerCss()` appends the selectors so iframes pick them up.
  - Samples (copy, do not paste into markdown): `docs/assets/themes/theme-{crimson,ocean,mist}.css`.
- ThemePop also has **apply** scope: global vs current app. That is *which palette is selected*, not where the file lives. The file is always host-global.
- Settings' disabled "Custom palettes are not available yet" is a leftover teaser. Ignore it; the picker that matters is ThemePop.
- Mini-apps never define a theme. They consume `mma-set-env` tokens.

## 3. Workstream 1 — Utils + motion

### 3.1 Motion

Shipped. Notes below record what actually happened where this section guessed wrong.

- Dependency: `motion` (`motion/react`). LLM-familiar; same component API as Framer Motion (`motion.div`, `AnimatePresence`, `variants`).
- **Landed as `/mma/vendors/motion.js`, not inside `/mma/sdk.js`** (§3.3 anticipated this
  option). `sdk.js` is ~2.4 MB on its own; folding motion in would cache-bust 196 KB of
  animation library on every kit edit, and keep them in one file only by giving the kit a
  second reason to grow.
- Because it is a vendor, the author specifier is the package name the model already types:

  ```tsx
  import { motion, AnimatePresence } from "motion/react";
  ```

  Bare `motion` resolves to the same file (it is what models type), which is **not** what
  the npm package's bare entry means — npm's `motion` is the *vanilla* API with no
  `motion.div`. The type wiring has to lie in the same direction or `from "motion"` would
  type-error while running fine; see the `paths` note in `scripts/check/templates.mts`.
- The UI compiler continues to reject a bare `"framer-motion"` specifier. One copy of React,
  one copy of motion, both in the iframe.
- The vendor table grew a **`targets`** axis (§3.3's table implied one but the mechanism had
  none): lodash resolves on both sides, motion is `ui` only. Without it, `import "motion"` in
  `main.api.ts` fell into the single hardcoded lodash branch and the app silently received
  `_`. `findVendor()` now turns that into a real message instead of “go install it”.
- Kit `Reveal` (blocks/reveal.tsx) is built on motion, and calls `useReducedMotion()`. Its
  `dist` entry externalises to the same vendor file, so the kit and the app share one motion
  runtime — the two Reacts problem again if the kit bundled its own.
- `references/styling.md` *Animation* rewritten in the same change (was: “a motion library is
  being decided”). The first cut banned app-injected `@keyframes` outright; that was
  over-converging a **naming** problem into a **prohibition** and has been replaced by a
  fence (see below).
- `mini_app_install` denylist covers `motion` + `framer-motion` with the working specifier in
  the error text.

#### Keyframes: fence, not ban

Each mini-app is its own iframe and therefore its own document
(`packages/panel/src/frame.ts` — `iframe.src = urlOf(appId)`), so an app's `@keyframes`
**cannot reach another app**. Uniquely named custom animation is safe, and a blanket ban was
just an agent losing a capability it was allowed to want. Two things do misbehave, both
inside one document:

1. re-declaring a name the platform sheet already defines;
2. declaring the same name twice in one app, where last-mounted wins for both users.

(2) is the bug that started this: one dashboard declared `@keyframes aibrief-soft` in two
components with different opacity values.)

So the host reports both as static-check **`notice`s** and reloads anyway. Not blocking is
deliberate: overriding a platform keyframe is sometimes exactly what the author means, and
the earlier “error” framing would have had the same cost as the ban it replaced.

The reserved names are **not a hand-written list** — `compile/platform-keyframes.ts` derives
them from the two things that actually inject CSS into an app document (`globals.css` and the
runner's inline boot CSS, now a leaf module `compile/runner-inline-css.ts` because both
`http/` and `compile/` need it). Add a keyframe to either and it is reserved on the next
reload. The derived set was checked against a live app document and matched exactly: `mma-dot
spin ping pulse enter exit accordion-down accordion-up scroll-fade-reveal-b/s/e tw-shimmer`.
- Paradigm `Reveal` was promoted into the kit (the old inlined copy in
  `packages/ui-examples/src/paradigms/shared.tsx` is now a re-export of the kit one, so all
  nine paradigms exercise it). `useCountUp` stayed a paradigm helper — still one caller each,
  no second consumer to justify promoting it. No second animation API was invented.
- `scripts/build/sdk.mjs` bundles motion with esbuild directly (constraint #10 did **not**
  bite: motion ships real ESM, so no `tsup.config.ts` external was needed and nothing had to
  be fetched from esm.sh — it is a normal workspace dep, cached with the rest of the build).

### 3.2 Lodash — the util library (complete, not curated)

The point is to stop the model emitting 8-line `groupBy` / `uniqBy` / `debounce` helpers. A home-grown `mma.utils` fails that: the model does not know the names, so it still writes the helper. A *subset* of lodash fails the other way — same lesson as the jQuery cut in P2-9: a famous API implemented in part is worse than none, because the model confidently calls methods we did not ship.

So: **real lodash, full API, both sides, under the specifier the model already types.**

Authors write (UI and backend):

```ts
import { groupBy, uniqBy, debounce, pick, omit, isEqual } from "lodash";
import _ from "lodash";
```

`lodash-es` is an alias of the same module (models use both).

#### Why a third iframe file, not a re-export from the kit

| Approach | Why not |
|---|---|
| `export * from "lodash"` on `@monkey-mini-app/ui` | `pnpm gen:skill` would dump 200 helpers into the component catalog |
| Bundle lodash into each app's `entry.js` | every mini-app pays the bytes; the whole point of `/mma/*` is one shared copy |
| `es-toolkit` / `radash` / a 30-function allowlist | models type `lodash`; missing `_.merge` is a silent rewrite into a worse helper |
| `@monkey-mini-app/utils` | a name the model has never seen |

#### Runtime shape — `/mma/vendors/<lib>.js`, not one concatenated file

Iframe platform becomes:

```
/mma/runtime.js           — React            (platform; complete, not curated)
/mma/sdk.js               — UI kit + useApp  (react external → runtime.js)
/mma/vendors/lodash.js    — lodash-es full + default `_` wrapper
```

Authors still type `from "lodash"`. The compiler maps the **npm specifier** onto a file under `/mma/vendors/`. Adding `date-fns` / `zod` later is another file in that directory + a row in the allowlist, not a new top-level `/mma/<lib>.js` and not a bigger blob.

**Rejected: a single `/mma/vendors.js` that `export *`s every lib.** Lodash and date-fns both export `min` / `max` / `isEqual`. If both specifiers externalise to the same ESM module, `import { min } from "lodash"` silently receives date-fns `min` (last `export *` wins). One file also cache-busts lodash every time we add zod, and would pull React-coupled `motion` into an isomorphic bundle. The extensibility we want is a **directory + allowlist**, not a namespace soup.

- `scripts/build/sdk.mjs` (or `scripts/build/vendors.mjs`) emits `vendors/lodash.js` next to `runtime.js` / `sdk.js`. Wrapper:

  ```js
  export * from "lodash-es";
  import * as es from "lodash-es";
  export default es;
  ```

  so both `import { groupBy } from "lodash"` and `import _ from "lodash"` work.
- Host `http-gateway.ts`: one route `GET /mma/vendors/:id.js` with an **allowlist** (`lodash` today). Unknown `:id` → 404, not a directory listing. Adding a lib = build artifact + allowlist row, not a new route.
- UI compiler: platform-module table, not a one-off regex.

  ```
  lodash | lodash-es     → /mma/vendors/lodash.js
  lodash/<fn>            → virtual `export { <fn> as default } from "/mma/vendors/lodash.js"`
  ```

  Copy the `RUNTIME_SPECIFIER` pattern (`external: true`). Deep `lodash/groupBy` must not receive the whole library as default.
- Backend loader: the **same table**. Specifier `lodash` / `lodash-es` returns the host's `lodash-es` (named + `default`). `lodash/<fn>` → `mod[fn]` as `default` / `exports`. Anything not in the table still throws `BACKEND_IMPORT`.
- Types: the app dir has no `node_modules`. Skill templates / `check:templates` need `lodash` types visible — ship `@types/lodash` as a dependency of `@monkey-mini-app/api` (and a `compilerOptions.paths` note in the skill) **or** vendor a `lodash.d.ts` next to the templates. Do not ask authors to `pnpm add lodash`.
- Size: full lodash-es is ~25 KB gzip, paid once per iframe, same order as React. Acceptable. Do not tree-shake at vendor-build time — the kit does not know which functions the *app* will call. Each vendor file is cached independently.

Skill: one row — "utils: `lodash` is available on UI and backend; prefer it over hand-rolled `groupBy` / `debounce` / `pick`". Do not paste the lodash API into markdown.

### 3.3 Other familiar helpers (same allowlist mechanism, not a second style)

Once the compiler has a platform-module table, the other LLM-familiar isomorphic libs use it too. Still not re-exported from the kit (same catalog reason).

| Specifier | UI | Backend | File / injection |
|---|---|---|---|
| `lodash` / `lodash-es` | `/mma/vendors/lodash.js` | injected | §3.2; v1 |
| `date-fns` | `/mma/vendors/date-fns.js` | injected | already a UI dep; add when a template would otherwise copy `format` |
| `zod` | `/mma/vendors/zod.js` | injected | models know `z.object` for `call` args |
| `motion` / `motion/react` | `/mma/vendors/motion.js` (react external → runtime.js) **or** stay inside `sdk.js` | no | React-only; never fold into lodash's file |
| `clsx` is unnecessary | `cn` already on `@monkey-mini-app/ui` | no | Tailwind-merge is UI-only |

v1 ships **lodash only** under `vendors/`. `date-fns` / `zod` / `motion` are the next rows, not a reason to concatenate.

`cn` stays a kit export. `z` / `format` do **not** also hang off `defineApp` — the model should type the package it already knows. Host injection of `@monkey-mini-app/api` remains `defineApp` only.

### 3.4 Explicitly not in (1)

- No subset of lodash. Full API or nothing.
- No `es-toolkit` / `radash` / `underscore` as a substitute. If we ship a lodash-shaped thing it is lodash.
- No ramda, axios, dayjs. `ctx.http` is the network; `date-fns` covers dates.
- No `@monkey-mini-app/utils` specifier and no merging ui + api.
- No `export * from "lodash"` on the UI kit (catalog pollution).
- No single concatenated `/mma/vendors.js`. Extensibility is `/mma/vendors/<lib>.js` + the specifier table.

## 4. Workstream 2 — Layout presets

### 4.0 How this list was chosen

The original gate — “the slot API must first be used by a real template” — is **withdrawn**
(owner decision, 2026-09-06). The product is pre-release: nothing is installed anywhere
(`runtime/apps` is empty), and the samples that would have exercised the API are being
rebuilt in §5 regardless. Waiting for that evidence would only reorder the same work.

So the list is defined the other way round: **from the page shapes SaaS apps actually
ship**, with the general-purpose ones kept because mini-apps are not all SaaS. Templates are
then written *against* these presets in §5, which is the validation — just paid for in the
cheap order.

Selection rule per preset: it must kill a bug agents demonstrably get wrong (column 3), not
just save typing. A preset that only saves typing is a Tailwind class string.

### 4.1 Scenarios
| # | Scenario | Who asks for it | Shape it needs |
|---|---|---|---|
| S1 | Records + one at a time: orders, tickets, contacts, logs → detail | CRUD/admin mini-apps, `todo`, `review` | list/detail split |
| S2 | Big filterable table: many columns, bulk select, saved views | spreadsheet-like, any inventory | toolbar + table + bulk bar |
| S3 | Overview / KPI dashboard: metrics row, charts, activity aside | `monitor`, ops dashboards | dashboard grid |
| S4 | Preferences: section nav + long form + save | app settings, integration config | nav/content split |
| S5 | Multi-step: create/import/onboard with validation per step | wizards, config generators | stepper + sticky actions |
| S6 | Focused create/edit form over a list you do not want to lose | nearly every CRUD app | sheet/drawer form |
| S7 | Board: columns of draggable cards + card detail | `jira`, pipelines, kanban | board + detail |
| S8 | Read-focused page: long document/report, TOC, anchored sections | insights, generated reports | prose + scrollspy |
| S9 | Full-screen empty/first-run: nothing data-shaped yet, just start | any app on first launch | centered single column |

S1–S6 are the SaaS core; S7–S9 are the general-purpose tail that mini-apps hit constantly
(`jira` is already S7, so it needs no new preset).

### 4.2 Presets — build order

Six page-level blocks under `packages/ui/src/blocks/`, `@family Layout & structure`, each with
`@when` naming a *page shape*, not “a layout”. Ordered by how often agents meet the shape ×
how badly they get it wrong without help.

| Order | Preset | Scenarios | Encodes (the bug it kills) | Slots |
|---|---|---|---|---|
| 1 | `ListDetail` | S1, S6 | `min-h-0` on both panes so each scrolls **independently**; `Resizable` split with a sane default; selected vs empty; detail collapses below `md` instead of squashing | `list`, `detail`, `empty?`, `toolbar?` |
| 2 | `TablePage` | S2 | the height chain from iframe → toolbar → grid → pagination; filter bar that does not eat the viewport; bulk bar overlaying rather than reflowing | `toolbar`, `grid`, `pagination?`, `bulk?`, `empty?` |
| 3 | `DashboardShell` | S3 | sticky header, KPI row, main + optional aside, `overflow-auto` **on the main pane only** (the classic “whole page scrolls, header slides away”) | `header`, `kpis?`, `main`, `aside?` |
| 4 | `SettingsSplit` | S4, S8 | side nav + section content with `Scrollspy` wired to real section ids; unsaved-changes bar pinned to the content pane, not the window | `nav`, `sections`, `footer?` |
| 5 | `WizardShell` | S5 | `Stepper` + scrollable body + **sticky** footer; back/next disabled state derived from step validity; body keeps its height between steps so the footer does not jump | `stepper`, `body`, `footer` |
| 6 | `FormSheet` | S6 | a `Sheet` whose header/footer stay fixed while only the form scrolls; single submit path; Escape-dirty confirm | `header`, `body`, `footer` |

**All six shipped 2026-09-10** — `pnpm gen:skill` publishes them, each with a contract test
that was canary-verified by re-introducing the bug it guards, and one gallery example.
`watch` was re-skinned onto `DashboardShell`; `sheets` deliberately stays on `ListDetail`
(its grid already lives in a pane that owns a scroller — wrapping it again would nest
scrollers, the failure class this table exists to remove).

S7 (`jira`'s board) and S9 (first-run) stay hand-written: `Kanban` already exists and the
`empty` component plus Tailwind covers a centred column — a preset for either would be a
wrapper that saves nothing an agent gets wrong.

### 4.3 Rules

- Built from existing kit pieces (`AppShell`, `Resizable`, `ScrollArea`, `Stepper`,
  `PageHeader`, `DetailPanel`, `FilterBar`, `DataGrid`, `Scrollspy`). No new CSS framework,
  no second layout engine.
- Every preset takes `className` and renders semantic HTML. No `Stack` / `Text` / `Box` —
  that rejection in `references/styling.md` stands.
- A preset never fetches, stores, or routes. It takes nodes; the app owns the state. Slots
  are `ReactNode` props, not render-props, so the generated code stays a tree an agent can
  see at a glance.
- Responsive collapse is the preset's job (S1's detail pane, S3's aside, S4's nav) — that is
  most of what “encodes” means here, and it is the part an agent omits.
- Chrome strings go through `useLabels` + `en.ts` / `zh.ts` in the same change.
- `AppShell` stays the generic frame; presets compose it, do not replace it.
- After adding: `pnpm gen:skill` so catalog + contracts pick them up. One example each, with
  a **distinct** `@scenario` from the table above.
- Each preset ships with a layout test that asserts the property it exists for (e.g.
  `ListDetail`: both panes scroll independently at a fixed height) — not a snapshot of markup.
  A preset whose scroll contract is untested will be “fixed” by the next agent into the bug
  it was written to kill.

The first cut is six, not four: `TablePage` and `FormSheet` were the two shapes most often
named when asking “what do agents actually build”, and leaving them out would send §5
templates back to hand-rolling the exact height chain this workstream exists to encode.

## 5. Workstream 3 — Templates and paradigms

Do this **after** (1) and (2) land, so the samples teach the new surface.

### 5.1 Templates

Keep the eight names — the capability axes in `templates/README.md` are already the right
split (`spreadsheet/` was added after this RFC was written; it earns its place as the only
template that teaches `mini_app_install`). Raise the floor:

- `minimal` is the **only** hello-world. If another template can be mistaken for it, that template has failed.
- Each of the other seven must demonstrate (a) its claimed `ctx.*` axis and (b) a preset or
  layout identity no other template uses. Pairing against §4.2:

  | Template | Preset / kit identity |
  |---|---|
  | `todo` | `ListDetail` + `storage.table` |
  | `review` | `ListDetail` with `DiffViewer` / `CodeEditor` as the detail — the pair must differ from `todo` in **content**, so if both keep `ListDetail` one of them moves to `TablePage` |
  | `monitor` | `DashboardShell` + charts, **no** llm |
  | `insights` | long-job progress in `DashboardShell`, or `WizardShell` if it stays multi-step |
  | `spreadsheet` | `TablePage` (it is already the closest thing to a real data grid) |
  | `agentrun` | `ctx.agent` + `streamTo` (the only one) |
  | `jira` | flagship: `Kanban` + `DataGrid` + `DetailPanel` + llm confirm — deliberately **not** a preset, to prove the presets are optional |
  | `minimal` | plain `AppShell` + Tailwind, and **no** motion — a skeleton must not cost a vendor download to read |

  Two templates sharing a preset is acceptable only when their `ctx.*` axes differ and the
  §2.3 look-alike complaint does not apply to them; the note on `review` is the live case.
- Motion is demonstrated by **exactly one** template (suggested: `monitor`, via kit `Reveal`
  on the KPI row) — not by all of them. Every sample that animates teaches the agent to
  animate, and the tokens are paid on every generation.

- Teaching comments stay `// ⭐`. Product copy stays Chinese in the samples (host default locale). Instructions/comments stay English.
- No ninth template without a new capability axis. A new scenario goes through "does an existing axis already cover this?". (The rule exists to stop look-alike samples, not to forbid growth: `spreadsheet/` was added later because it is the only template that teaches `mini_app_install` — see [`per-app-packages.md`](./per-app-packages.md).)
- `templates/README.md`'s table gets a **preset** column in the same change, so "which sample
do I copy" answers the layout question too and not only the capability question.

### 5.2 Paradigms

Keep the style-vs-template split. Redesign `packages/ui-examples/src/paradigms/*` with the **ui-ux-pro-max** skill (professional type scale, colour, density — not a new home-grown language). Then `pnpm gen:skill && pnpm gen:examples`.

Cull if two skins teach the same lesson after the pass. Candidates for merge: `saas` vs `ops` vs `darkdata` (all dashboards). `semantic.tsx` stays — it is the only proof that identity is tokens, not hex.

Paradigms must use kit `motion` / `Reveal` once (1) exists; delete the inlined copies.

## 6. Workstream 4 — Project intent and boundary (no runtime fence)

Mini-apps exist so the **machine owner** can generate reusable apps that call the host's real `ctx` (`bash` / `http` / `llm` / …). That premise already is the permission model. The runtime does **not** sandbox those calls, and this RFC does not add one. A fence that disables `ctx.bash` is not a missing feature — it is a different product.

What we write is a **project-level** statement of intent and boundary, in `README.md` **and** `README.zh.md` (same commit). Keep it short and factual, next to License (or a titled subsection under Why it exists). Do not invent a `references/security.md` that agents must pay for on every task — this is for humans reading the repo.

**Intent**

- Local, owner-operated. The authoring agent and the generated app run with the host process's privileges because that is the job.
- `ctx.*` is the host, not a toy. The iframe is a crash/DOM boundary against the panel (cross-origin); it is not a machine sandbox.

**Boundary**

- This is not a multi-tenant cloud, not a place to run untrusted third-party code, not an evaluation jail.
- A mini-app you just generated is as trusted as you. Treat someone else's app like a shell script they emailed you.

Draft (EN; ZH twin in the same commit):

> Mini-apps run locally as the host user. `ctx.bash`, `ctx.http`, and `ctx.llm` are real host capabilities, not a sandbox — that is the point of the product. The UI iframe isolates a crashed view from the panel; it does not isolate the machine. This project does not claim to confine what a mini-app can do on your computer.

No threat-model essay. No "we sandbox eval" / "we jail bash" sentence.

### 6.1 Fences — only if we share packages, and only on those packages

Do **not** track bash cwd jails, iframe `sandbox`, network allowlists, or default-off capability grants as a follow-up to this workstream. They fight the owner-operated loop and would land as a lie ("we have a sandbox") or as a broken `ctx`.

A fence becomes in scope **only when there is a share/install path** (a package that did not come from this machine's current authoring session). Even then it is **package-scoped**: review, capability declaration, or a warning on install of *that* artifact — not a new default around every locally generated app. That work waits on the sharing feature; it is not a TODO hanging off README.

## 7. Workstream 5 — Custom theme authoring (host-global)

P1-4 solved "what tokens a mini-app may *use*". This solves "when the user wants a named palette, how the agent *creates* one for the whole host" — including a pairing that still works when they flip light/dark.

The loader is done. This workstream is skill + a generated file contract + one small panel refresh so a just-written file shows up.

### 7.1 When to do this

Only when the user **asks** for a custom / named / branded theme ("来套暗红", "公司绿", "只要黑白"). Default is: pick a builtin in ThemePop, write no file, never put hex in `ui.tsx`.

A custom theme is **host-global** (one CSS file every app can select). It is not a per-app stylesheet and not a `className` on the mini-app root. After the file exists, the user (or the agent, via the panel) can apply it globally or to the current app — that is ThemePop's existing scope toggle.

`mini_app_edit` cannot write this file (it is outside the app dir). Use the host file tools. Path:

```
<dirname(runtimeRoot)>/themes/theme-<id>.css
```

`runtimeRoot` comes from `mini_app_list` / `host.json`. Id is `[a-z0-9-]+`. Creating the directory is allowed.

### 7.2 File contract (generated, not handwritten)

Two vocabularies — the skill must not mix them:

| Layer | Names | Who writes them |
|---|---|---|
| Mini-app UI | `--background`, `--primary-foreground`, `bg-card` | `ui.tsx` (already in generated `theme.md`) |
| Custom theme file | `--bg`, `--fg`, `--primary-fg`, … (`THEME_VAR_KEYS`) | `themes/theme-<id>.css` |

`parseThemeCss` only sees the short names. An agent that copies `theme.md` into the CSS file produces a file that is silently ignored.

Extend `scripts/gen/skill/theme.mjs` (or a sibling) to emit, from `THEME_VAR_KEYS` in `packages/panel/src/themes.ts`:

1. Required vs optional keys (`bg` / `fg` / `primary` required in **both** modes; others filled from defaults).
2. A skeleton `theme-<id>.css` (comments + empty declarations, **no** pretty hex — samples live in `docs/assets/themes/`).
3. The exact header + selector shape:

```css
/* name: 显示名 */
:root[data-mode="light"] { --bg: …; --fg: …; --primary: …; }
:root[data-mode="dark"]  { --bg: …; --fg: …; --primary: …; }
```

`check:skill` fails if the documented keys drift from `THEME_VAR_KEYS`. Do not paste `theme-crimson.css` values into markdown.

### 7.3 Light / dark pairing (handwritten recipe, short)

This is the quality bar. Put it in the skill as rules, not a colour-theory essay. Reference `docs/assets/themes/theme-crimson.css` as the worked example (same hue family, not an invert).

1. **One hue family, two densities.** Light and dark are a pair. Do not design them independently and do not invert (`#f7f2f1` → `#080d0e` of a different hue).
2. **Contrast first.** `fg` on `bg`, `surface-fg` on `surface`, `primary-fg` on `primary`, `muted-fg` on both `muted` and `bg` must all read. If `muted-fg` vanishes on `bg`, the dashboard chrome dies.
3. **Dark is not "light but dimmer".** Drop `bg` / `surface` to a near-black of the same hue; **lift** `primary` chroma so it still pops (`crimson` light `#c0392b` → dark `#ff5c4d`). `primary-fg` flips with the new primary (white on a mid red, near-black on a neon red).
4. **Elevation.** `surface` is a step above `bg` (lighter in light mode, slightly lighter-than-bg in dark). `border` is visible against both. `shadow` stronger in dark.
5. **Destructive stays a distinct red** in both modes, even if the brand hue is already red — then shift brand toward brick and keep destructive as the alarm.
6. **Monochrome request.** If the user wants 黑白 / graphite: keep `primary` as a mid grey (not blue), still pair light paper-grey with dark charcoal; do not ship a pure `#000` / `#fff` only pair — `muted` / `border` / `surface` need room.
7. **Do not** put a second accent hue in unless asked. `accent` is a wash of `primary`, not a complementary colour.
8. **Verify both modes** in ThemePop after writing. A palette that only looks right in dark has failed.

No visual theme editor. No new colour science in `themes.ts`.

### 7.4 Panel: show a file that was just written

`listCustomPalettes` already re-reads disk. The panel fetches palettes **once on mount** (`loadCustomPalettes` in `panel.tsx`), so a file written mid-session is invisible until reload.

Change: refetch `/api/palettes` when ThemePop opens (and after a successful host-file write if we have a hook). Do not revive the disabled Settings "Custom" row; hide or delete that teaser.

### 7.5 Not in (5)

- Per-app theme *files*. Apply-scope per app already exists; a second CSS file under the app dir does not.
- Mini-app-authored themes (`<style>` / hex in `ui.tsx`) — still forbidden.
- Unifying `globals.css` oklch with panel hex as a colour-system rewrite (mechanical mapping stays as `cssVars()`).
- A GUI theme editor.

## 8. Sequence

Independent of the kit, land first:

1. **(4) README(.zh) intent + boundary** — no runtime change, twins in one commit; do not add a skill page agents pay for on every task.
2. **(5) generated custom-theme file contract + skill recipe (when / path / pairing) + ThemePop refetch** — loader already exists.

Then the kit, in order:

3. **(1a) `/mma/vendors/lodash.js` + specifier table on compiler and backend** — ✅ landed.
3b. **(1b) `motion`** — ✅ landed as `/mma/vendors/motion.js` (not folded into `sdk.js`: the
    kit is already ~2.4 MB and every kit edit would otherwise cache-bust motion). The vendor
    table grew a `targets` axis because motion is React-only — `import … from "motion"` in
    `main.api.ts` fails `BACKEND_IMPORT` instead of falling through to “install it”, or to
    the lodash module the way a single hardcoded vendor branch did. `styling.md` *Animation*
    ships in the same change (see the rule below). `Reveal` promoted onto it.
4. **(2) six layout presets** — see §4. The old gate (“the slot API must be used by a real
   template first”) is **dropped**: this product is pre-release, there is no installed app to
   protect, and the samples that would have exercised the API are being rebuilt anyway (§5).
   The presets are therefore specified from the page shapes SaaS apps actually need, and the
   templates are written **against** them afterwards — which is the same evidence, just in
   the cheaper order.
5. **(3) templates + paradigms** — consume (1b)(2); `pnpm check:templates && pnpm gen:skill && pnpm gen:examples`.

Do not merge 3 into 1. Do not ship motion without updating `styling.md` in the same change.

## 9. Acceptance

- Authors can `import { groupBy, debounce } from "lodash"` (and `import _ from "lodash"`) in `ui.tsx` **and** `main.api.ts`; `lodash-es` and `lodash/groupBy` resolve to the same full build. `import { motion, AnimatePresence } from "motion/react"` works in UI. Bare specifiers outside the platform table (`axios`, `ramda`, `dayjs`, …) still fail compile / backend load. Lodash is **not** a named export of `@monkey-mini-app/ui`.
- The six presets of §4.2 appear in the generated catalog with distinct `@when` / `@scenario`,
  each with a test that asserts the scroll/overflow property it exists for.
- `minimal` is the only skeleton; each other template uses a unique capability × layout pair; paradigms have no inlined `Reveal`.
- README(.zh) states owner-operated intent and that `ctx.*` is not a sandbox; no sentence claims a runtime fence; no `references/security.md` on the hot path.
- Skill tells an agent, **only when the user asked**, to write `<dirname(runtimeRoot)>/themes/theme-<id>.css` with both light and dark TokenSet keys (generated from `THEME_VAR_KEYS`, not copied from app-facing `theme.md`). A just-written file appears in ThemePop without restarting the host. `check:skill` fails if the documented file keys drift. Mini-apps still contain no hex.
- `pnpm verify` green after each workstream, not only at the end.

## 10. Out of this RFC

- Skill NL → intent → PRD → `ui.tsx` workflow (`rough-ideas.md` item 6).
- Tauri / pi-desktop host (`docs/rfcs/pi-extension-port.md`, `rough-ideas.md` item 7).
- Measuring generation efficiency.
- Sharing/install of third-party mini-app packages (the only future place a package-scoped fence would belong).
