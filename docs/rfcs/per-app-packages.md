# RFC: Per-app backend packages (`mini_app_install`)

> Date: 2026-09-05
> Status: **proposal** (not implemented)
> Packages: `packages/host` · `packages/api` · skill
> Related: [`authoring-protocol.md`](./authoring-protocol.md) (closed import graph) · [`authoring-surface.md`](./authoring-surface.md) (lodash is a **platform** vendor, not this) · README trust model (owner-operated, no runtime sandbox)

## 0. Verdict

**Do not turn every mini-app into an npm project. Do not vendor a host list of drivers. Do not tell users to install a Kafka/Excel MCP first.**

When a task needs a **Node library the platform does not ship**, the agent installs that library **into that app** with a dedicated tool. Default apps stay zero-dependency and one-turn. Excel today, a vendor SDK tomorrow — the platform does not enumerate domains.

Driving software **already installed on the machine** (open Excel, call Word) is `ctx.bash` / the OS, not a package. This RFC is only for `import { … } from "<npm spec>"` on the **backend**.

## 1. Problem

Backend `main.api.ts` is loaded with sucrase + a custom `require`: `@monkey-mini-app/api`, `lodash` / `lodash-es`, and relative paths inside the app dir. That is deliberate (fast reload, no `postinstall`, no native compile, a closed import surface the skill can teach).

It also means a generated app cannot `import { Kafka } from "kafkajs"`, cannot use `exceljs` / `docx`, cannot use a vendor’s official SDK. Chat-generated HTML and a one-off Python site *can* grow a dependency; the mini-app currently cannot.

That gap is **domain libraries in general**, not “databases”. MySQL / SQL Server were only examples. Tomorrow it is spreadsheets, a message bus, or some company’s Node client. A product that tries to pre-install every client will lose.

What we will not do instead:

| Approach | Why not |
|---|---|
| User installs a skill / MCP for each system | Unrealistic. “Make a Kafka manager for localhost:9092” must work without a shopping trip |
| Host allowlist (`mysql2`, `kafkajs`, `exceljs`, …) | Same treadmill. Zhang wants MySQL, Li wants SQL Server, next week Word — we do not ship a catalog of the world’s libraries |
| Every app is an npm project by default | Hello-world pays install; models `pnpm add axios` / `lodash` (already platform); `postinstall` on every scaffold |
| `ctx.bash pnpm add` | Untracked, host-cwd, easy to infect the host tree; no lockfile contract |
| Invent `ctx.excel` / `ctx.kafka` | Famous APIs implemented in part (P2-9 / lodash lesson). Models type `kafkajs` and `exceljs` |
| Open the **UI** import graph | Kafka/ExcelJS do not belong in the iframe. UI still `call()`s the backend |

## 2. Target

```
Default app:     no package.json, no node_modules, today's loader
App that needs a lib:  package.json + lockfile + node_modules  under the app dir
Install:         mini_app_install({ appId, packages })   // not bash
Load:            backend require() of those specs from *that app's* node_modules
UI:              unchanged (react + @monkey-mini-app/ui + lodash + relatives)
```

The **model** picks the package name from the task (`exceljs`, `kafkajs`, `tedious`, …). The **platform** does not keep a domain list. The skill only keeps a **denylist** of things already provided (`lodash`, `react`, `axios` → use `ctx.http`, …).

## 3. Design

### 3.1 Layout (app dir)

Optional, next to `manifest.json`:

```
package.json          # dependencies only; no scripts we execute
package-lock.json     # or pnpm-lock.yaml — pick one installer and stick to it (see §3.2)
node_modules/         # gitignored at app level; recreated by install
```

`node_modules` is **not** committed. The lockfile **is** (reproducible reload / later sharing). `mini_app_list_files` already skips `.git` / `storage`; skip `node_modules` the same way.

Do not put a `package.json` on `minimal` / `todo`. Absence means “closed loader, no install step”.

### 3.2 Installer

One tool, host-run, not `ctx.bash`:

```
mini_app_install({
  appId,
  packages: [{ name: "exceljs", version?: "^4" }, ...],
  remove?: string[],          // optional uninstall
})
```

Behaviour:

1. Ensure `package.json` (`{ private: true, dependencies: {} }`). Refuse `"scripts"` that we would execute (strip or reject — prefer **strip on write**, never run them).
2. Add/remove the named deps. Pin with a lockfile.
3. Run **`npm install --ignore-scripts --omit=dev`** in the app dir (npm ships with Node; do not require pnpm on the user’s machine). Network is allowed: owner asked for this library.
4. Return `{ ok, packages, lockfile, error? }` — install failure is a reload-quality error, not a silent empty `require`.

Denylist (tool + skill, same list): `react`, `react-dom`, `lodash`, `lodash-es`, `axios`, `@monkey-mini-app/*`, `typescript`. Use the platform / `ctx.http` instead.

No `latest` in the tool’s happy path if the model omitted a version: resolve once, write the resolved range into `package.json` + lockfile so the next reload does not float.

### 3.3 Backend loader

Today: spec `@monkey-mini-app/api` → inject `defineApp`; `lodash` / `lodash-es` → host lodash; `./…` → app tree; anything else → `BACKEND_IMPORT`.

Add, **after** those, **before** the hard fail:

- Resolve `spec` from `path.join(appDir, "node_modules")` only (Node’s resolver, `paths: [appNodeModules]`). Host / plugin `node_modules` must not leak in.
- If missing: `BACKEND_IMPORT` naming the spec and “run `mini_app_install` first”.
- Deep specs (`exceljs/lib/foo`) allowed if they resolve under that `node_modules`.

UI compiler: still reject these specifiers. Excel/Kafka stay in `main.api.ts` / `api/**`.

v1 loads the module **in the host process** (same as today’s `defineApp` injection). A crash in a native addon can take down the host — accepted for v1, documented next to the trust model. A worker/child-process backend is a follow-up, not a gate for “can this app `import exceljs`”.

### 3.4 Skill (when to install)

Closed graph remains the default. Install is an exception with a recipe, not a new default stack:

1. `ctx.http` / `ctx.bash` / existing `ctx.tool` · `ctx.mcp` — if they already do the job, **do not install**.
2. Need a Node library (file format, binary protocol, vendor SDK) → `mini_app_install`, then `import` from that spec in `main.api.ts`.
3. Never install the denylist. Never install a UI library into the backend.
4. Credentials still come from `ctx.credentials` (host-supplied). A client library is not an excuse to hardcode connection strings in `ui.tsx`.

Do not paste a catalog of recommended packages into the skill. The model already knows `exceljs` vs `kafkajs`. A stale catalog is worse than none.

### 3.5 Trust / sharing

Owner-operated: installing a library the user asked for is in bounds (same as `ctx.bash`). `--ignore-scripts` is the difference from “npm as the user typed it”.

When **sharing** exists (see authoring-surface §6.1), the fence is **on the package**: lockfile + still ignore-scripts + a warning that this artifact pulls npm code. Local apps the owner just generated do not grow a new default sandbox.

A **first-run approve/reject UI** for extra packages is a later idea (§7). Internal use does not need it; do not block §5 on it.

## 4. Explicitly not in this RFC

- Making UI an npm project / bundling arbitrary packages into the iframe
- Host-vendored `mysql2` / `kafkajs` / `exceljs`
- A `ctx.excel` / `ctx.db` façade
- Running package `scripts` / `postinstall`
- Requiring pnpm on the user’s machine
- Backend worker isolation (named follow-up)
- Changing `ctx.tool` / MCP (still valid when the host already has the tool)
- First-run / install-time package approval UI (§7) — recorded, not in the first cut

## 5. Sequence

1. Loader: resolve extra specs from `appDir/node_modules`; skip `node_modules` in file listing.
2. `mini_app_install` + denylist + lockfile; `pnpm check:skill` knows the tool name.
3. Skill paragraph (when / when not). One template **does not** need a sample `package.json` until a scenario actually uses a lib — do not add an eighth template for this.
4. Tests: install a tiny pure-JS dep in a temp app dir, `call` a method that imports it; unknown spec still fails; denylist rejected; UI import of that spec still fails.

## 6. Acceptance

- `minimal` / `todo` still have no `package.json` and do not hit the network on reload.
- An app can `mini_app_install({ packages: [{ name: "exceljs" }] })` then `import ExcelJS from "exceljs"` in `main.api.ts` and `call` succeeds.
- `import "exceljs"` from `ui.tsx` still fails compile.
- `mini_app_install({ packages: [{ name: "lodash" }] })` is rejected.
- `import "kafkajs"` without install still `BACKEND_IMPORT` with a pointer at the tool.
- `node_modules` is not listed by `mini_app_list_files`.
- README trust model unchanged: this is not a sandbox; ignore-scripts is supply-chain hygiene, not confinement.

## 7. Deferred: first-run approval of extra packages

**Not implementing now.** Internal use can `mini_app_install` and run. Recorded so we do not invent a host driver list *or* a fake sandbox in the meantime.

### Idea

The loader already wraps `require`. Extra specs (anything resolved from the app’s `node_modules`, not `defineApp` / lodash) stay **pending** until the owner approves them. First time the app would actually load those modules — `mini_app_call` **or** the user opening the app — the **mini-app host** (not the agent shell) shows a hard modal:

- list of extra packages (direct deps from `package.json`, not a dump of every transitive name unless we decide that)
- whatever public signals we can fetch to help a human judge (npm downloads, GitHub stars / last publish — best-effort, missing data is allowed)
- per package **Approve** / **Reject**

Rejected → that `require` fails closed (clear error, app does not silently skip). Approved → remembered for this app (and maybe this version of the lockfile) so the next call does not re-prompt.

### When to prompt: install vs first run

| Moment | Pros | Cons |
|---|---|---|
| During `mini_app_install` / “build” | Closest to the decision; agent is still in the turn | Host may have no window (headless `mini_app_call`); agent-shell `confirm()` is **not** a stable API across dsh / pi / no-shell `pnpm dev:host` |
| First `call` or first **open** | Always a real UI surface (panel). Matches “about to run” | Agent’s first `mini_app_call` in the same turn blocks until a human clicks; need a pending state and a timeout/error if nobody is looking |

Leaning: **host-owned modal on the panel**, not `ctx.ui.confirm` / dsh dialogs. The mini-app cannot control the agent platform’s chrome; a panel modal is the one window we own on every adapter.

Install-time prompt is nicer UX **if** the panel is already open. First-run intercept is the reliable hook because `require` is already ours. Likely both: install records “pending”; `require` of a pending spec opens/focuses the modal and fails the call until resolved.

### What must be a closed loop before anyone builds this

Do not ship a half-modal. At least:

1. Where the list is stored (`host.json` / per-app file / lockfile hash).
2. Direct vs transitive (approve `exceljs` — do its deps auto-run?).
3. What `mini_app_call` returns while the modal is up (`pending-approval`, not a hang).
4. Open-app path vs call path share the same pending set.
5. Registry metadata failing (offline, npm down) still shows the name + version.
6. Changing the lockfile invalidates prior approvals.

Until that loop is designed against a real panel, this stays a note.

