# Mini-app templates

Each template is a different **reference scenario**: one layout prototype × one capability axis, showing **what to borrow and what it demonstrates**. Use the table to find the closest starting point — real apps routinely take pieces from several (a monitor page that summarises with the model borrows `monitor` + `insights`).

| Template | One line | Copy it when | What it teaches |
|---|---|---|---|
| [minimal](./minimal/) | Smallest runnable skeleton | Starting out / connectivity check / you just need a working shell | `defineApp` + one `useApp().call` round trip + `AppShell`/`PageHeader` skeleton |
| [todo](./todo/) | Local CRUD + filtering + derived stats | Storing local data with add/edit/delete and a status filter | `ctx.storage` + one fixed-height scrolling screen + `FilterBar` + multiple tables via `storage.table()` |
| [insights](./insights/) | Web data → model summary (long job) | External data plus summarisation, and it will be slow | `ctx.http` + `ctx.llm({schema})` + **sampling / progress / `ctx.signal` cancellation** (`scan` / `scanStatus` polling) |
| [monitor](./monitor/) | Live machine-metrics dashboard | Monitoring, overview pages, charts, KPIs | `ctx.system.metrics()` + `ctx.bash` (only for `ps`/`df` the host does not provide) + polling that stops when hidden |
| [review](./review/) | Code/text comparison + test-case table | Reviewing diffs or cases, with write-back editing | `DiffViewer` (original/modified) + `CodeEditor` + `DataGrid` column filters/sorting + saving back |
| [agentrun](./agentrun/) | Multi-step model work with visible progress | You need `ctx.agent` (**the only** demonstration of it) + cancel/progress | `ctx.agent` + `onEvent` → storage → UI polling + module-level `AbortController` cancellation |
| [jira](./jira/) | Complex business simulation (multi-view + state machine + AI) | Ticket / Jira / project-management style apps, several views, AI assist | `Kanban` + `DataGrid` dual view + editing in a detail `Sheet` + status palette + `ctx.llm` drafting something the user confirms |

## How to use them

1. **Start from the closest template** (by the "copy it when" column); **open others whenever your app spans capabilities** — boards + AI summary means reading `jira` *and* `insights`. Read file by file (`main.api.ts` for behaviour, `ui.tsx` for layout) and stop when you have what you need.
2. **Lift the pattern, not the file.** Copy structure, naming, and the technique you came for; do not paste 300-line samples wholesale (`jira/ui.tsx`) — you pay for those tokens on every regeneration. `minimal/` is the right base when you only need a skeleton.
3. Comments marked `// ⭐` are the **teaching points** — skimming them captures the lesson (e.g. `ctx.agent`, `storage.table`, cancelling via `ctx.signal`, `DiffViewer`'s original/modified, `StatusBadge` expecting lowercase statuses).
4. **Conventions every template follows** (regardless of which one you read):
   - Exactly one platform package on both sides: `@monkey-mini-app/sdk`. UI adds `react`; helper code lives in `ui/` (UI only), `api/` (backend only), `shared/` (pure, both). No other npm packages (an app directory has no `node_modules`).
   - Icons: `import { Icon } from "@monkey-mini-app/sdk"` → `<Icon.HelpCircle />`; empty states use exactly the 10 `Illu*` listed in [../references/icons.md](../references/icons.md).
   - The only route to the backend is `useApp().call(method, args)` (from the SDK); `method` must be a key of `defineApp({ api })`.
   - List / board / table rows are located for edits by their `key` field. Layout uses Tailwind classes.
   - Visible copy in these samples is Chinese because the shipped host defaults to that locale — instructions and code comments are English. When the host locale is English, write English product strings.
