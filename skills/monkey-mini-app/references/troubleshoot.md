# Troubleshooting

Match the **literal message** you got. `mini_app_reload` prefixes each `errors[]` entry with the failing layer; `mini_app_call` surfaces runtime messages.

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
| `ui: …` | UI bundle failed | Read the tail; see "UI messages" below |
| `ui compiler not wired` | The host has no UI compiler attached | Host install problem, not an app problem ("Host-side" section) |
| `commit: …` | Compiled fine, the auto-commit failed | Changes are on disk; commit explicitly with `mini_app_history_commit` |

## Runtime / smoke-test messages

| Message | Root cause | Fix |
|---|---|---|
| `Method not found: <m>` | `call("<m>")` is not a key of `api` | Align with `defineApp({ api })` keys (case-sensitive) |
| `main.api must export defineApp({ name, description, api })` | Missing `export default defineApp({...})` | Add the default export |
| `defineApp requires name and description` | One of them is missing | Provide both |
| `defineApp.api must be an object` | `api` written as a function or array | `api: { async list(ctx) {…} }` |
| `backend cannot import '<spec>'. Backend may import @monkey-mini-app/sdk and relative paths inside the app dir` | Backend imported an npm package or a Node builtin | Backend: `@monkey-mini-app/sdk` (`defineApp`) + relative paths only |
| `backend cannot import '<spec>': ui/** is UI-only` | Backend reached into the UI tree | Move the shared logic to `shared/**` |
| `backend import escapes app dir: <spec>` | Backend imported `../` past the app root | Keep every import inside the app dir |
| `unsafe relative path: <rel>` | Path contained `..` or was absolute | `mini_app_*` `path` values are app-relative |
| `register requires manifest.json` | `files` had no manifest | Add it |
| `cancelled` | The user pressed stop and `ctx.signal` fired | Expected behaviour; long jobs must wire it (see ctx.md) |

## UI compile messages

| Message | Root cause | Fix |
|---|---|---|
| `UI cannot import main.api.ts; use useApp() from @monkey-mini-app/sdk` | UI imported the backend | Go through `call(method, args)` |
| `UI cannot import api/**: "<spec>"` | UI reached into the backend tree | Move the shared logic to `shared/**` |
| `UI import escapes the app dir: "<spec>"` | `../` pointed at a sibling app or outside | Keep every import inside the app dir |
| `missing ui entry (ui.tsx / App.tsx)` | `manifest.entry` points at a file that isn't there | Match `entry` to the real file |
| `Failed to resolve import "<pkg>"` | Imported an npm package the app directory does not have | UI: `react` / `@monkey-mini-app/sdk` / in-app relative paths. React, lucide and recharts already ship inside the SDK |

## It compiles but looks wrong

| Symptom | Check first | Note |
|---|---|---|
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
