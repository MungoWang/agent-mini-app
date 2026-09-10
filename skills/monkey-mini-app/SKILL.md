---
name: monkey-mini-app
description: Create or edit local mini-apps (ui.tsx + main.api.ts) — small self-contained web tools that run in the mini-app panel. Typical asks a todo/notepad, an internal utility, a data dashboard, a monitor page, a report, a kanban board, visualising a script's output, or an LLM summary page. Trigger phrases include 做个小程序 / 小工具 / 面板 / 仪表盘 / dashboard / 看板 / 帮我可视化 / mini-app. Create with mini_app_register, change with mini_app_read + mini_app_edit, compile-verify with mini_app_reload, smoke-test with mini_app_call, reveal with mini_app_open. Not for editing host / panel / SDK source, and not for writing the dsh or pi plugin itself.
---

# monkey-mini-app

Generate or modify a local mini-app. Reference docs and templates live **next to this SKILL.md** (`references/`, `templates/`) — always open them by relative path; never assume where a given host installed the skill.

**Language rule for this skill:** instructions are English; the Chinese in code samples is *product copy* that the end user sees. Mini-app UI text follows the host locale (the samples use Chinese because the shipped host defaults to it) — do not translate user-facing strings when you adapt a template.

**`ctx` and the model APIs are defined by [references/ctx.md](references/ctx.md) and [references/llm-json.md](references/llm-json.md)** (incl. `llm` / `agent` / `schema` / `onEvent`). Live apps are not a contract: do not read `~/.monkey-mini-app/runtime/apps/*/`.

## How files reach disk

Writing `~/.monkey-mini-app/runtime/**` directly is refused by the sandbox — always go through the `mini_app_*` tools (no curl, no bash against `:17880`).

| Goal | Tool | Notes |
|---|---|---|
| Inspect an existing app's manifest + absolute dir | `mini_app_get({ appId })` | Call this before editing — beats guessing |
| List its source files | `mini_app_list_files({ appId })` | Skips `.git` / `storage` |
| Read one file | `mini_app_read({ appId, path })` | `startLine`/`endLine` or `offset`/`limit`; `numbered: true` for `N\|` line prefixes |
| **Edit an existing file** (main path) | `mini_app_edit({ appId, path, edits })` | `edits: [{ oldText, newText }]`; each `oldText` must be **unique** in the file. Never rewrite a whole tree to change one line |
| New file / large rewrite | `mini_app_write({ appId, path, content })` | |
| Delete one file | `mini_app_delete({ appId, path })` | `manifest.json` cannot be deleted |
| Create a whole app | `mini_app_register({ appId, files })` | `files` keys are relative paths, values full text; must include `manifest.json` |
| Validate + compile + warm cache | `mini_app_reload({ appId })` | After every round of edits — see below |
| **Add a backend npm library** | `mini_app_install({ appId, packages: [{ name: "exceljs" }] })` | Only when `main.api.ts` must `import` a real Node library. Never for `lodash` / `motion` / `axios` / `react`. Not importable from `ui.tsx`. |
| Smoke-test api methods | `mini_app_call({ appId, method, args })` | Or `calls: [{ method, args }]` for a whole set in one round trip |
| Show it to the user | `mini_app_open({ appId })` | Returns whether a panel actually received it |
| **Read runtime errors** | `mini_app_errors({ appId, since? })` | The only way to see a UI that compiled and then crashed |
| **Ask the rendered view** | `mini_app_view_eval({ appId, code? })` | Run JS in the live DOM — what actually rendered, at what size, with which styles |
| Confirm the plugin is alive | `mini_app_list()` | |

`mini_app_register` shape (`ui.tsx` + `main.api.ts` are the two entries; add `ui/…` / `api/…` / `shared/…` as needed — `..` and absolute paths are rejected):

```
mini_app_register({
  appId: "com.example.foo",
  files: {
    "manifest.json": "...",
    "ui.tsx": "...",
    "main.api.ts": "...",
    "ui/Card.tsx": "...",
    "api/parse.ts": "...",
    "shared/format.ts": "..."
  }
})
```

Mutating tools **auto-commit** by default; pass `commit: false` to batch a few edits and let one final `mini_app_reload` close the round. Versioning (`mini_app_history_commit` / `mini_app_history_list` / `mini_app_history_reset` / `mini_app_history_revert`, single branch, revert = forward commit) → [references/history.md](references/history.md).

**Deleting a whole app is a user action** in the panel. There is no unregister tool — do not delete the directory, do not curl `DELETE`.

### What `mini_app_reload` returns

`{ ok, errors, notices?, compiled, committed, caches }`. The **prefix** of each `errors[i]` names the failing layer — fix that layer, don't shotgun.

**Cache contract (do not second-guess this):** every successful reload drops the in-memory API module, UI bundle, **and app CSS** (`caches.appCss` is always `"dropped"`), and signals open panels to re-fetch. The tool also defaults to `cleanCaches: true` (purges `.autogen/` + on-disk bundles) so a stale Tailwind artifact cannot linger — pass `cleanCaches: false` only when you intentionally want to keep disk caches. Read `caches.views` to know whether a browser actually re-fetched.

Error prefixes:

| Prefix | Meaning | Next step |
|---|---|---|
| `appId must be reverse-DNS` | Bad id shape | Use `com.<you>.<thing>` |
| `app not registered` | Nothing on disk yet | `mini_app_register` first |
| `manifest: …` | Missing key / broken JSON | Needs `id` `name` `version` `entry` |
| `main.api: …` | Backend compile, relative-import resolution, or an undefined name | Read the rest of the message |
| `ui: …` | UI bundle failed, or an undefined name/component | Usually a disallowed import or a typo'd identifier |
| `shared: …` | Undefined name in `shared/**` (used by both sides) | Fix in `shared/` |
| `commit: …` | Compiled fine, auto-commit failed | Commit explicitly with `mini_app_history_commit` |

`committed.status` is explicit, because "nothing happened" and "I could not commit" need different follow-ups:

| `status` | Meaning |
|---|---|
| `committed` | New commit (`commitId` set) |
| `clean` | Nothing to commit — `mini_app_edit` already auto-committed it |
| `skipped` | Compile failed, so no commit was attempted |
| `failed` | Commit itself errored (`reason`; also in `errors[]`) |

**Compile green is not "it runs".** `errors[]` from an undefined identifier *is* caught now (`"greeting()" is called but never defined or imported`, often with a `did you mean`), and `notices[]` carries lower-confidence findings — read them, they are cheap. What no compile step can see is anything that only fails at render time, so finish the loop:

### Debug loop (this is the part that used to need a human)

```
edit → mini_app_reload → mini_app_open → mini_app_errors → mini_app_view_eval
```

1. `mini_app_reload` until `ok: true`.
2. `mini_app_open` — the iframe mounts and streams back anything it throws. `panel: "no-panel-connected"` means no browser is attached: the app is fine, nobody is looking, so tell the user to open the panel.
3. Give it a moment to render, then `mini_app_errors`. Empty + never opened ≠ clean; the hint says when to re-read.
4. `mini_app_view_eval({ appId })` (no `code` = the `#root` subtree) to see what actually drew — then ask it anything in JS: did that class apply, which node has no width, is that subtree `display:none`.

`mini_app_errors` polls with `since: <lastSeq>`; a reload clears the ring, so errors after a reload are only from the new build. `mini_app_view_eval` needs a live view and says which of `not-open` / `runner-not-booted` / `stuck` it hit when it does not get one → **[references/eval.md](references/eval.md)**.

More symptoms → [references/troubleshoot.md](references/troubleshoot.md).

## Protocol

**Two author packages:** `@monkey-mini-app/ui` (UI: `useApp` + components) and `@monkey-mini-app/api` (backend: `defineApp`, host-injected). The UI compiler externalises `react` + the UI package; the backend loader injects `defineApp` only. Any other bare import is a compile error by design.

**Layout** (enforced, not cosmetic):

```
manifest.json · ui.tsx · main.api.ts
ui/        → UI only (components, hooks)      backend may NOT import it
api/       → backend only (helpers, ctx work)  UI may NOT import it
shared/    → both — pure code only: no React, no DOM, no ctx, no Node
```

A trivial app needs none of the three folders. Relative imports may use any subfolder name, but must stay inside the app dir.

- UI may **not** `import` `main.api.ts`
- UI: `const { call } = useApp()` — you own loading/error state; `useApp` comes from `@monkey-mini-app/ui` (never implement your own)
- Backend: `export default defineApp({ name, description, api })` (`name` **and** `description` are required; import `defineApp` from `@monkey-mini-app/api` — the host injects the runtime copy, nothing React gets loaded)
- `call("foo")` must be a key of `api.foo`
- Backend imports: `@monkey-mini-app/api` + relative paths inside the app dir (no npm, no Node builtins)
- Fetching: `ctx.http(url)` / `ctx.http(url, { method, headers, query, body, timeout })`; put parsing in `api/`
- Machine commands only via `ctx.bash` (`{ stdout, stderr, exitCode }`)
- **Model**: `ctx.llm(prompt, opts?)` / `ctx.agent(goal, opts?)` → **string**. Shared opts: `provider?` `model?` `system?` `schema?` `maxTokens?` `signal?`; `agent` adds `onEvent?` `maxIterations?` `cwdType?` `cwd?`. Structured JSON → [llm-json.md](references/llm-json.md); full signatures and event shapes → [ctx.md](references/ctx.md)
- MCP / tool args are plain objects — never `{ input: "..." }`; `ctx.tool` / `ctx.agent` / `ctx.llm` all return **string** (the host stringifies tool results)
- Copy is for the end user; card titles speak business (`「今日摘要」` / "Today's digest"), never `ctx.bash` or `storage/*.json`
- **Long jobs run sampled only**, must honour `ctx.signal`, and expose `scanStatus`/`progress` — see [ctx.md](references/ctx.md)

## UI (`@monkey-mini-app/ui`)

**The component library is a convenience, not a mandate.** It exists so you stop rebuilding wheels — use it where it fits, but never contort a design to use it. Free-form UI is expected:

- **Decide first**: is there a component for this that actually fits? **Yes → use it** (fewer tokens, consistent look). **No, or the design needs its own visual/interaction, or the user asked for free play → build it from native elements (`div`/`span`/`button`/`input`/`table`/`svg`…) + Tailwind classes.** Do not bend the design to fit the library.
- **Mixing is normal**: library components for the skeleton (cards / page header / dialogs), native + Tailwind for the distinctive parts.
- **Boundary of free play**: native elements and Tailwind are unlimited, but `ui.tsx` may only import `react`, `@monkey-mini-app/ui`, `lodash` / `lodash-es`, `motion` / `motion/react`, and in-app relative paths — never `api/**`, never `../` out of the app dir, never another npm package. Hooks from `react`; components, `useApp`, and `cn` from the SDK.
- **Not your job**: the theme provider and the app runtime are wrapped by the host; there is no `Stack`/`Text` layout component — use Tailwind classes.
- Component props list **only their own API**: `className`, `style`, `onClick`, `aria-*` are never repeated (every component takes them). Conversely, **never guess the part names of a compound component** (`Dialog` + `DialogTrigger` + `DialogContent`, not `<Dialog title>`) — read its contract.

The snippet below is a common shape, **not the only shape** — complex or bespoke UI may well be fully hand-written.

```tsx
import { useState } from "react";
import { useApp, Button, Input, Card, CardContent, CardHeader, CardTitle } from "@monkey-mini-app/ui";

export default function Ui() {
  const { call } = useApp();
  const [draft, setDraft] = useState("");
  ...
  return (
    <Card className="mt-8 w-full">
      <CardHeader><CardTitle>Name</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write something" />
        <Button onClick={async () => { await call("add", { title: draft }); }}>Add</Button>
      </CardContent>
    </Card>
  );
}
```

- **Layout is Tailwind** (`flex flex-col gap-3 p-4 grid md:grid-cols-3 w-full space-y-4`)
- **`cn` is already in the kit** — `import { cn } from "@monkey-mini-app/ui"` (`clsx` + `tailwind-merge`). Prefer it over concatenating class strings.
- **Tailwind is compiled per app from your source** — variants (`hover:` `group-hover:` `md:`), the default palette (`bg-rose-500`) and arbitrary values (`w-[437px]`) all work, so **do not fall back to inline `style` out of caution**. The one trap: class names must be complete literals — `` `bg-${x}-500` `` generates nothing, silently → **[references/styling.md](references/styling.md)**
- **Colour is tokens, never hex** — the user's palette rewrites token values under `<html>`, a literal breaks dark mode → **[references/theme.md](references/theme.md)** (generated token table). **Do not invent a theme in `ui.tsx`.** Two escape hatches, both rare: a host-global custom palette (`themes/theme-<id>.css`) when the user asks for a named brand — *Custom host theme file*; or an app-local `theme.css` when the **style itself depends on a hue** (a look the app carries, e.g. neon signage) — *App-local palette*. A plain CRUD/table/settings app ships neither.
- **`lodash` is a platform module** on UI and backend (`import { groupBy, debounce } from "lodash"`). Prefer it over hand-rolled `groupBy` / `uniqBy` / `pick` / `debounce`. Bare `axios` / `ramda` / `dayjs` still fail.
- **`motion` is a platform module** (UI only — `import { motion, AnimatePresence } from "motion/react"`). Use it for enter/exit/layout, Tailwind `transition` for a one-property hover, and kit `<Reveal delay={i * 60}>` for a staggered entrance. Custom `@keyframes` are allowed — give them your own name, since keyframe names are global inside the app's document and the platform already defines `spin` / `pulse` / `enter` / `exit` / … → **[references/styling.md](references/styling.md)** *Animation*.
- **Need a library the platform does not ship** (a real file format, a binary protocol, a vendor SDK): `mini_app_install({ appId, packages: [{ name: "exceljs" }] })`, then `import ExcelJS from "exceljs"` in `main.api.ts`. Order of preference: `ctx.http` → `ctx.bash` / `ctx.tool` → install. Backend only — the UI still gets JSON through `call`.
- **Icons**: `import { Icon } from "@monkey-mini-app/ui"`, then `Icon.HelpCircle` (any lucide name works); **curated subset + when to use** → **[references/icons.md](references/icons.md)** (don't page through a thousand names)
- **Empty-state illustrations** — exactly these 10, the names are not guessable: `IlluEmpty` `IlluNoData` `IlluSearch` `IlluLoading` `IlluServerStatus` `IlluAccessDenied` `IlluPageNotFound` `IlluDataProcessing` `IlluBugFixing` `IlluCodeReview`
- Component index (props + types) → **[references/catalog.md](references/catalog.md)** and **[references/contracts/](references/contracts/)** (generated; after changing a component run `pnpm gen:skill`).
- **Prefer a ready example over writing a widget from memory**: each component contract lists [references/examples/](references/examples/) files, one scenario each (e.g. `data-grid-01` = sort+search+pagination, `data-grid-02` = rich cells via renderers). They import `react` + `@monkey-mini-app/ui` + relatives only, so copy one into `ui/` and edit — do not invent a variant no example shows.
- The SDK already bundles React / lucide / recharts — **never** import those yourself
- **Heavy editors load from a CDN on demand** (not npm): `CodeEditor` pulls CodeMirror 6 from `esm.sh`; `CodeBlock` / `DiffViewer` pull shiki; `RichTextEditor` is a local contentEditable editor (no CDN, no dependency). Do not `import` `@codemirror/*` / `shiki` / `@tiptap/*` / `@uiw/react-codemirror` (the last one brings a second React). When the CDN is blocked the components degrade — see [troubleshoot.md](references/troubleshoot.md)

| Need | Components |
|---|---|
| Page skeleton | `AppShell` `PageHeader` `FilterBar` `DetailPanel` |
| KPI cards | `StatCard` `TrendCard` `StatusBadge` `SeverityChip` |
| Tables | `DataGrid` + `ColumnDef` (sorting / filtering / paging / CSV built in) |
| Date & time | `DatePicker` `DateRangePicker` `DateTimePicker` `TimePicker` `DurationInput` `RelativeDatePicker` |
| Boards / calendar / plans | `Kanban` `EventCalendar` `Gantt` `Timeline` `Stepper` |
| Trees / lists | `TreeView` `SortableList` `FileTree` |
| Editors | `CodeEditor` `MarkdownEditor` `RichTextEditor` `CodeBlock` `Markdown` |
| Inspect / logs | `DiffViewer` `JsonViewer` `LogViewer` `RequestInspector` `Terminal` |
| Form extras | `SearchInput` `NumberField` `TagInput` `ConfirmDialog` `FileDropzone` `Copyable` `UserPicker` |
| Charts | `DonutChart` `StackedBarChart` `Sparkline` `Gauge` `RadarChart` + L1 `Chart` |
| Primitives | `Button` `Input` `Select` `Dialog` `Sheet` `Tabs` `Card` `Badge` `Toast` `Empty` … |

## CRUD skeleton (edit this for plain local notes)

`manifest.json`:

```json
{
  "id": "com.example.foo",
  "name": "My Mini App",
  "description": "One line description for the app",
  "version": "0.1.0",
  "entry": "ui.tsx",
  "acronym": "MA"
}
```

There is **no theme block**. Colour comes from the host palette unless the app ships its own
`theme.css` — see [references/theme.md](references/theme.md) → *App-local palette*.

Product strings (`name`, `description`, every label the user sees) follow the **host locale** — the shipped host defaults to Chinese, so the samples are Chinese. Instructions and comments stay English.

`acronym` (optional): two letters used as the monogram on the host's list card. Omit it and the host derives one (pinyin initials for Chinese names, e.g. `备忘录` → BW; first two letters for Latin names). Only set it to override a brand name.

`main.api.ts`:

```ts
import { defineApp } from "@monkey-mini-app/api";

async function loadItems(ctx) {
  const items = await ctx.storage.get("items");
  return Array.isArray(items) ? items : [];
}

export default defineApp({
  name: "My Mini App",
  description: "One line description for the app",
  api: {
    async list(ctx) {
      return loadItems(ctx);
    },
    async add(ctx, args) {
      const title = String(args?.title ?? "").trim();
      if (!title) throw new Error("请填写标题");
      const items = await loadItems(ctx);
      const item = { id: "i_" + Date.now(), title, createdAt: Date.now() };
      items.unshift(item);
      await ctx.storage.set("items", items);
      return item;
    },
    async remove(ctx, args) {
      const items = (await loadItems(ctx)).filter((x) => x.id !== args?.id);
      await ctx.storage.set("items", items);
      return { ok: true };
    },
  },
});
```

## Read on demand (do not open everything)

| When | Open |
|------|------|
| Component props / types | [references/catalog.md](references/catalog.md) → [references/contracts/](references/contracts/) |
| **Which Tailwind classes work / how to colour** | [references/styling.md](references/styling.md) |
| **What actually rendered (live DOM query)** | [references/eval.md](references/eval.md) — recipes, output format, the four `view` states |
| **Theme token table + custom host theme file** | [references/theme.md](references/theme.md) (generated — do not hand-edit) |
| **A runnable starting point for one component** | contract's `## Examples` → [references/examples/](references/examples/) (each file = one scenario: `@title` + `@scenario`; layout/pattern recipes in `examples/<group>.md`) |
| Icon subset (`Icon` namespace, when to use) | [references/icons.md](references/icons.md) |
| Full `ctx.*` contract (incl. agent `onEvent` shapes) | [references/ctx.md](references/ctx.md) (use `ctx.http`, not bash curl) |
| Structured JSON via `schema` | [references/llm-json.md](references/llm-json.md) |
| **Actually using** `ctx.tool` | `mini_app_list_ctx_tools` first, then [references/tools.md](references/tools.md) |
| Relative imports, `ui` / `api` / `shared` layout | [references/loader.md](references/loader.md) |
| Human debugging of host `:17880` / curl | [references/test.md](references/test.md) (≠ `ctx.http`) |
| Errors | [references/troubleshoot.md](references/troubleshoot.md) |
| Versioning / rollback | [references/history.md](references/history.md) |

**Templates are reference material, not a menu you must choose one from.** Read [`templates/README.md`](templates/README.md) to find the closest starting point, and open whichever others cover your app's capabilities (a dashboard that calls the model = `monitor` + `insights`). **Extract the pattern you need — structure, naming, cancellation, progress events — rather than pasting whole files** (`jira/ui.tsx` is 300+ lines), and read one file at a time so you spend tokens on the user's app, not on the samples.

| Scenario | Template |
|---|---|
| Minimal runnable baseline | `templates/minimal/` |
| Local CRUD + filtering + derived stats | `templates/todo/` |
| Web data → model summary (long job / sampling / cancel) | `templates/insights/` |
| Live machine metrics dashboard (`system` + `bash`) | `templates/monitor/` |
| Edit / diff / logs / test cases (complex components) | `templates/review/` |
| `ctx.agent` multi-step job + progress / cancel | `templates/agentrun/` |
| Board + table dual view + editing + AI (flagship) | `templates/jira/` |
| Local `.xlsx` parsing via an installed library + model digest | `templates/spreadsheet/` (needs `mini_app_install` first) |

For plain storage CRUD **start from the skeleton above** — don't read the whole Todo app to take a note. Templates are style references: product copy in the user's language, `call` owns loading/error, backend may use TypeScript.

## Checklist

- [ ] New app via `mini_app_register`; edits via `mini_app_get` / `mini_app_list_files` + `mini_app_read` + `mini_app_edit` (or `write`)
- [ ] Started from the closest template(s), lifted patterns/structure rather than pasting whole files
- [ ] `mini_app_reload` compiles (located the failure by `errors[i]` prefix) and `notices[]` was read
- [ ] `mini_app_call` smoke test passes (not curl) — batch with `calls: []` instead of N round trips
- [ ] `mini_app_open`, then `mini_app_errors` — **compile green ≠ it renders**; do not stop at the build
- [ ] `mini_app_view_eval` confirms the styling actually applied (no hardcoded hex, no composed class names)
- [ ] `call` keys ⊆ `api` keys; no fetch / secrets / llm in the UI; compound part names taken from a contract, not memory
