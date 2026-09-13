# Troubleshooting

Match the **literal message** you got. `mini_app_reload` prefixes each `errors[]` entry with the failing layer; `mini_app_call` surfaces backend runtime messages; `mini_app_errors` surfaces **UI** runtime messages (the ones no compile step can see).

## The UI is blank / wrong and the build was green

That is expected: a bundle can compile and still throw at render. The loop is

```
mini_app_reload → mini_app_open → mini_app_errors → mini_app_view_eval
```

`mini_app_errors` returns `kind` + `message` + `componentStack`. `componentStack` names the component that threw, which a raw browser stack does not.

| `kind` | Meaning | Typical cause |
|---|---|---|
| `render` | Thrown while React was rendering — caught by the app's error boundary | undefined name, bad props, a hook called conditionally |
| `module` | The compiled bundle never evaluated | bad import, SDK missing, entry mismatch |
| `uncaught` | Threw outside render | an event handler, a timer callback |
| `async` | A promise rejected with no handler | `call()` without a `catch`, un-awaited fetch |

If the ring is empty you probably never opened it — the hint says so. An app that renders **but looks wrong** is a `mini_app_view_eval` question, not an error question.

The UI compile **strips types and does not typecheck**. Wrong `useStore` keys, a mistyped
`call("…")`, or a prop the component does not have all compile green and throw `TypeError`
at render (`kind: render` in `mini_app_errors`). Fix the key against the contract.

### `mini_app_view_eval` did not answer

| `view` | Meaning | Next step |
|---|---|---|
| `not-open` | no browser is attached, or nothing is showing this app | `mini_app_open`, then retry |
| `runner-not-booted` | the iframe exists but its script never ran | `mini_app_errors` (a `module` error), then `mini_app_open` |
| `pending` | your query is **still running** in a healthy view | raise `timeoutMs` (default 1500, max 8000) or return before awaiting. Nothing is broken and the user must not be told to reload — the host proved that by getting an answer to a trivial probe |
| `stuck` | the script ran, then stopped answering, and even the trivial probe went unanswered — the thread really is blocked | a `while (true)` in your own `code` does this, and it wedges the panel page too: tell the user to reload the tab |
| `live` + `ok: false` | the view is fine, **your query** failed | `error.line` / `error.source` point into your JS |

More → [eval.md](eval.md).

## "Did my change actually take effect?"

`mini_app_reload` answers this in its own result, so you never have to infer it from a
screenshot. **CSS is part of the contract, not an afterthought:** a successful reload always
drops the in-memory build of the API module, the UI bundle **and** the app's Tailwind CSS
(`appCss: "dropped"`), then tells every attached panel to re-fetch. There is no "CSS somehow
stayed" path — if `caches.appCss` is not `"dropped"`, something else is wrong.

```json
{ "ok": true, "caches": { "uiBundle": "dropped", "appCss": "dropped", "autogen": "removed", "views": "reload sent to 1 attached panel" } }
```

- `views: "no panel attached — nothing was showing this app"` → the browser never re-fetched,
  because there was nothing to re-fetch. Call `mini_app_open`.
- `views: "not sent (compile failed)"` → fix the compile; the memos still went, so the next
  attempt cannot inherit the old bytes.
- **`cleanCaches` defaults to `true` on the tool** — on-disk build output (`.autogen/`, cached
  bundles) is purged and rebuilt, so a stale Tailwind artifact cannot survive a normal reload.
  Pass `cleanCaches: false` only when you deliberately want to keep those files (faster, but
  you are trusting the disk cache). The underlying `AppsManager.reload` API still defaults to
  `false` when called without opts; only the tool flips the default.

To prove the frame is a *new document*, compare `performance.timeOrigin` across the reload —
the refreshed URL carries a cache-buster, so a real reload always changes it:

```
mini_app_view_eval({ appId, code: "return performance.timeOrigin" })   →  reload  →  ask again
```

Unchanged means it never reloaded. Then assert your *content* too: query a string only the new
code can print, rather than looking at the panel.

## `LLM_JSON_INVALID` / `LLM_RETRY_EXHAUSTED`

`ctx.llm(prompt, { schema })` retried and still got nothing parseable. The message lists every
attempt (`err.attempts`: `kind` `json` | `transport`, `error`, `bytes`, `head`) — read it before
changing anything, the shape of the bad answer *is* the diagnosis:

| The attempts say | Meaning | Fix |
|---|---|---|
| `transport`, 0 bytes every time | the model never answered | provider/config, not your prompt |
| `json` with `head` = prose ("Here is the JSON:") | the schema instruction lost to the chatty system prompt | shorten `system`, put constraints in `schema` |
| `json` with `head` = truncated object, `bytes` suspiciously round | hit the output ceiling | pass a bigger `maxTokens`, or ask for fewer items |
| `json` with `head` = reasoning text | the budget died before the answer | bigger `maxTokens`; a reasoning model needs headroom |

Never wrap `ctx.llm` in a hand-rolled salvage parser: the retries and the evidence are already the
same thing, one layer down.

## `mini_app_reload` → `errors[i]` prefix

| Message | Root cause | Next step |
|---|---|---|
| `appId must be reverse-DNS (e.g. com.example.todo)` | Bad appId shape | Use `com.<you>.<thing>`; no Chinese, spaces or underscores |
| `app not registered; call mini_app_register({ appId, files })` | Nothing on disk for that id | `mini_app_register` first — do not `edit` |
| `app not found: <id>` | Same, or a typo in the id | Check `mini_app_list` |
| `manifest: manifest missing <key>` | Missing `id` / `name` / `version` / `entry` | All four are required; `entry` is usually `"ui.tsx"` |
| `manifest: manifest is not valid JSON` | JSON syntax (trailing comma, comment) | `manifest.json` allows **no** comments or trailing commas |
| `manifest: manifest id is not a valid AppId` | `manifest.id` differs from appId or is malformed | They must be equal |
| `missing main.api.ts` | No backend entry | Create `main.api.ts` (a single `list` method is fine) |
| `main.api: …` | Backend compile failed / relative import unresolved | Read the tail; see "backend messages" below |
| `main.api: "x()" is called but never defined or imported` | Typo or missing import in the backend | Fix the name; reload re-checks |
| `ui: …` | UI bundle failed | Read the tail; see "UI messages" below |
| `ui: JSX component <X /> is not defined or imported` | Used a component you never imported | Add it to the `@monkey-mini-app/ui` import |
| `ui: hook "useX" is called but not imported` | Hook used without `import { useX } from "react"` | Import it — hooks are never globals |
| `shared: …` | Undefined name in `shared/**` | Fix in `shared/` — both sides import from there |
| `ui compiler not wired` | The host has no UI compiler attached | Host install problem, not an app problem ("Host-side" section) |
| `commit: …` | Compiled fine, the auto-commit failed | Changes are on disk; commit explicitly with `mini_app_history_commit` |

### `committed.status` after a reload

| `status` | Meaning | Do |
|---|---|---|
| `committed` | A new commit was made | — |
| `clean` | Nothing changed since your last `mini_app_edit` (it auto-commits) | Nothing — this is normal |
| `skipped` | Compile failed, so nothing was committed | Fix `errors[]` first |
| `failed` | Commit itself errored (`reason`) | `mini_app_history_commit`, or check the git dir |

## Runtime / smoke-test messages

| Message | Root cause | Fix |
|---|---|---|
| `Method not found: <m>` | `call("<m>")` is not a key of `api` | Align with `defineApp({ api })` keys (case-sensitive) |
| `main.api must export defineApp({ name, description, api })` | Missing `export default defineApp({...})` | Add the default export |
| `defineApp requires name and description` | One of them is missing | Provide both |
| `defineApp.api must be an object` | `api` written as a function or array | `api: { async list(ctx) {…} }` |
| `backend cannot import '<spec>'. Install it first: mini_app_install(...)` | The app needs that library but it is not in its own `node_modules` | Run `mini_app_install({ appId, packages: [{ name: "<spec>" }] })`, then `mini_app_reload`. Do **not** move the import into `ui.tsx` |
| `backend cannot import '<spec>' (no package.json)` | Same, and nothing has ever been installed for this app | `mini_app_install` creates the manifest — never hand-write `package.json` |
| `backend cannot import '<spec>': it resolves outside this app's node_modules` | The app is reaching the plugin's/repo's dependency tree | Reinstall the package into the app; a host dependency is not an app dependency |
| `Cannot find package '<x>'`-style npm failure from `mini_app_install` | Typo, no network, or the name is not on the registry | Fix the name/version; report the npm stderr to the user rather than inventing a substitute |
| `backend cannot import '<spec>': ui/** is UI-only` | Backend reached into the UI tree | Move the shared logic to `shared/**` |
| `backend import escapes app dir: <spec>` | Backend imported `../` past the app root | Keep every import inside the app dir |
| `unsafe relative path: <rel>` | Path contained `..` or was absolute | `mini_app_*` `path` values are app-relative |
| `register requires manifest.json` | `files` had no manifest | Add it |
| `cancelled` | The user pressed stop and `ctx.signal` fired | Expected behaviour; long jobs must wire it (see ctx.md) |

## UI compile messages

| Message | Root cause | Fix |
|---|---|---|
| `UI cannot import main.api.ts; use useApp() from @monkey-mini-app/ui` | UI imported the backend | Go through `call(method, args)` |
| `UI cannot import api/**: "<spec>"` | UI reached into the backend tree | Move the shared logic to `shared/**` |
| `UI import escapes the app dir: "<spec>"` | `../` pointed at a sibling app or outside | Keep every import inside the app dir |
| `missing ui entry (ui.tsx / App.tsx)` | `manifest.entry` points at a file that isn't there | Match `entry` to the real file |
| `Failed to resolve import "<pkg>"` | Imported an npm package the app directory does not have | UI: `react` / `@monkey-mini-app/ui` / in-app relative paths. React, lucide and recharts already ship inside the SDK |

## It compiles but looks wrong

| Symptom | Check first | Note |
|---|---|---|
| A class did nothing | Whether the class name is a **complete literal** | Tailwind scans source text: `` `bg-${x}-500` `` generates **no CSS and no error**. Full names only → [styling.md](styling.md) |
| Kit classes work, `w-[437px]` / `backdrop-blur-*` do not; no `.autogen/` | Per-app CSS compile failed. Older hosts **silently served `/ui.css`** as the app sheet | `GET /api/app/<id>/ui.css` must not equal `GET /ui.css`. 0.1.11+ returns **500** + a CSS comment and logs `appId`. Upgrade the plugin; installed hosts need the runtime CLI |
| `bg-card/60` / bare `bg-destructive` transparent | App sheet missing `@theme` bridge (host < 0.1.12) or class not a full literal | Upgrade host; confirm `.autogen/ui.css` has `color-mix` for that class; escape hatch `color-mix` on `var(--card)` → [styling.md](styling.md) |
| `backdrop-blur-*` did nothing | App-compiled utility (not in the kit sheet) and blur over the iframe/skin is unreliable | Same `color-mix` wash; do not rely on `backdrop-blur-*` for glass |
| Colours wrong in dark mode | Any hardcoded hex | Use tokens → [theme.md](theme.md); the user's palette rewrites token values |
| Custom theme file does not appear | Wrote `--background` or only one mode | File keys are `--bg` / `--fg` / `--primary` in **both** light and dark → [theme.md](theme.md) *Custom host theme file*; reopen the theme pop |
| A node rendered to nothing | Its box and its classes, from the view | `mini_app_view_eval({ appId, code: 'return mma.$$("#root *").filter(n => !n.getBoundingClientRect().width).map(mma.selector)' })` — usually a class that never compiled, or a condition that never matched |
| A token looks unset | The **computed** value, not the class name | `const cs = getComputedStyle(mma.$(".x")); return { color: cs.color, bg: cs.backgroundColor };` → [styling.md](styling.md) |
| Panel still shows the old app after a fix | It should have refreshed on its own (`app:reload`) | If the browser was not attached to `/api/events`, use the panel's reload button |
| The iframe is a thin strip | **Not an app problem** | Host iframe height; refresh or reopen the panel |
| Blank page, no console error | Whether `#root.boot` gets cleared | That is load art only; it must be gone before mount |
| Editor missing / code not highlighted | `CodeEditor` `CodeBlock` `DiffViewer` | They fetch CodeMirror / shiki from `esm.sh` on demand; on a blocked network they degrade. **Do not** `pnpm add` them and do not `import @codemirror/*` / `shiki` |
| Rich text editor looks plain | `RichTextEditor` | It is a local contentEditable editor — no CDN, no dependency |
| `ctx.http` times out | `http: timeout` / `http: only http/https` / `http: response too large` | Pass `timeout`; http/https only; page or sample large payloads |
| `ctx.llm` says no model service / stream empty | Model not configured | A human configures it in settings or `POST /api/llm-config`; app code stays `await ctx.llm(...)` |
| `ctx.tool` reports no tool service | This profile has no tools | Use `storage` / `http` / `bash`; check first with `mini_app_list_ctx_tools` |
| MCP does nothing | Args wrapped as `{ input }` | Pass the business object directly |

## Host side (human debugging — not the app's fault)

| Symptom | Handling |
|---|---|
| `:17880/api/apps` returns 404 | Plugin not started, or the port is not 17880 — see [test.md](test.md) |
| `@monkey-mini-app/... dist not found` | Host install is missing build output; a maintainer runs `node scripts/build/ui.mjs && node scripts/build/sdk.mjs` |
| `tailwindcss CLI not found` / `app ui.css failed` 500 | `@tailwindcss/cli` was only a **devDependency** of `@monkey-mini-app/ui` before 0.1.11, so an npm-installed plugin under pnpm had no CLI. Upgrade `dsh-mini-app` / `host` / `ui` to ≥0.1.11 and reinstall. `/ui.css` (kit) can stay 200 while `/api/app/<id>/ui.css` is 500 |
