# RFC: Looks catalog + product facades

> Date: 2026-09-08
> Status: **landing** — supersedes [`authoring-surface.md`](./authoring-surface.md) §5
> (templates / paradigms). Layout presets (§4) still land on their own; facades use
> `ListDetail` where it exists and Tailwind for the rest.
> Preview (review mock, not product): [`docs/assets/looks-templates-preview.html`](../assets/looks-templates-preview.html)

## 0. Verdict

Split the overlapping `paradigms/` + `templates/` pile into two layers:

| Layer | What it is | What it is not |
|---|---|---|
| **Facade** (template) | A runnable mini-app, cut by **interaction loop**. Already wears a default Look. The only thing an agent copies as a skeleton. | Not a `ctx.*` lesson name. Not a second gallery. |
| **Look** | A frozen colour-intent + layout grammar + surface recipe. Spec markdown (and later a light/dark PNG). | Not an app. Not a kit API. Not a cartesian product of palettes × layouts. |

Component examples (`ui-examples/src/components`) stay. They do not teach style.

Style is **recommended practice**, not a gate. No `data-look` runtime, no Look components, no class-string lint on facades. `data-look` may appear in a spec as an optional recipe. Agents may ignore Looks entirely.

PNG screenshots are **deferred** (owner will capture). Specs ship without image files.

### Per-app colour (approach B, as built)

An app may ship `theme.css` (same `parseThemeCss` contract as host `themes/theme-*.css`).
**The file's presence is the whole decision** — `manifest.theme.followsHost` was deleted: it was
parsed and never read, and "does this app own a palette?" has exactly one answer already.

Resolution (`effectivePalette` in `packages/panel/src/themes.ts`):

| `theme.json` palette | `theme.css` | renders with |
|---|---|---|
| — | yes | the app's file |
| — | no | host palette |
| a host / custom id | either | that palette (pin) |
| `__global__` | yes | host palette |
| `__local__` | yes | the app's file |

`跟随全局` writes the `__global__` **sentinel** rather than deleting `theme.json`: clearing would
land back on the file, making the row a no-op for exactly the apps it matters to. Deleting stays
available as `theme.json` reset ("restore this app default"), which is a different question.

ThemePop: scope first; appearance is always system/light/dark in both scopes (an app may follow
the OS on its own); `本应用` is a palette row, shown only in app scope. Chips: 系统 / 自定义 / 本应用.
Only hue-dependent looks ship a file — `glass-island`, `signage`, `terminal`; the neutral ones
follow the host on purpose. `theme.md` → *App-local palette* is generated from the same key list
as the host-global contract, so the two cannot drift.

## 1. Why

Nine paradigm TSX files (~100 KB) were copied into the skill and never listed on the SKILL.md hot path. Eight templates taught capabilities but looked like Header + grey cards. Agents either never saw style, or swallowed a fake dashboard.

`semantic.tsx` is not a Look — it is the token lesson, already in `references/styling.md`.

## 2. Looks (8)

`saas-board` (conventional KPI row) is **kit default**, not a Look file.

| id | Grammar (wireframe must differ with colour covered) | Default on |
|---|---|---|
| `glass-island` | Poster + dock: type sits on the sky; two glass slabs at the bottom. Not a mosaic. | `today` |
| `aurora-bento` | 6×3 tessellation, edge to edge, every cell a destination. No sky. | `board` |
| `desk-split` | Two panes, hairline, dense toolbar. | `sheets` |
| `editorial` | Measure, type hierarchy, hairline rules, almost no cards. | `radar` |
| `tape` | Tabular numerals, vertical rules, colour = delta only. Solid ground, **no graph-paper grid**. | `watch` |
| `void` | Sparse, huge type, one hairline. Not a dashboard. Opt-in. | — |
| `signage` | Display type + chroma wash + caption columns. Cyberpunk is signage, not glow cards. Opt-in. | — |
| `terminal` | Mono well, status lamps, colour = state. | `runner`, `chores` |

Every Look has a light and a dark pair (same hue family, two densities). Specs say so even before PNGs exist.

Source of truth: `packages/ui-examples/src/looks/catalog.json`. Live fixtures next to it (kit components, mini-app-portable) feed demo-host so a human can screenshot later. **Skill does not copy the TSX.** `pnpm gen:skill` writes `references/looks/*.md` from the JSON.

Classes in the spec are complete Tailwind literals using tokens / `color-mix(var(--primary))`. No hex in author UI.

## 3. Facades (7 + skeleton)

Cut by loop: copying the wrong facade would copy the wrong *kind of running*.

| Folder | Product | Loop | Preset (now) | Default Look |
|---|---|---|---|---|
| `minimal` | 骨架示例 | one `call` | `AppShell` | — |
| `today` | 今日台子 | open → see my screen → open one record | `ListDetail` | `glass-island` |
| `board` | 阶段看板 | many items move in 2D status | Kanban + Sheet (preset optional) | `aurora-bento` |
| `radar` | 信息雷达 | I trigger → wait → read (cancellable) | Tailwind | `editorial` |
| `sheets` | 表格台 | file in, grid work, what changed | DataGrid (+ later `TablePage`) | `desk-split` |
| `runner` | 执行器 | the model walks; the UI *is* the run | `RunTimeline` + `Terminal` | `terminal` |
| `chores` | 一键杂事 | named buttons, known script, no model | `AppShell` | `terminal` |
| `watch` | 值班屏 | numbers move by themselves; no Start | Tailwind (+ later `DashboardShell`) | `tape` |

`chores` must stay buttons. A prompt box makes it `runner`.

Not facades: forms, editors, calendars, chat (kit + presets); habit journal (wrong data model if copied from `today`, not a wrong loop).

Deleted lesson-named templates: `todo`, `review`, `insights`, `jira`, `monitor`, `agentrun`, `spreadsheet`. Teaching comments (`// ⭐`) move with the loop that owns them (`storage.table` → `today`, `mini_app_install` → `sheets`, `ctx.agent` → `runner`, polling-when-hidden → `watch`, http+llm+cancel → `radar`).

## 4. Agent read path

1. SKILL.md table: pick a facade by loop. Do not open Looks by default.
2. Open that facade. It already looks like a product.
3. Only if the user names a style: `references/looks/index.md`, then one spec.
4. Fuse class / grammar into the facade. Do not start a second app.

## 5. Kit usage

Facades and look fixtures prefer `@monkey-mini-app/ui` (`AppShell`, `PageHeader`, `ListDetail`, `Kanban`, `DataGrid`, `FileDropzone`, `MiniCalendar`, `Terminal`, `RunTimeline`, `StatCard`, `FilterBar`, `Sheet`, `Reveal`, …). Free-form Tailwind is allowed for the distinctive grammar (island sky, tape numerals, void type, signage). No new Look primitive.

`Reveal` is demonstrated on **one** facade (`watch`).

## 6. Out of this RFC

- Remaining layout presets (`TablePage`, `DashboardShell`, `SettingsSplit`, `WizardShell`, `FormSheet`) — still P1-1.
- Look PNG pipeline (Playwright). Specs reserve `preview.light` / `preview.dark` paths; files come later.
- Custom host theme files for neon (`theme-neon.css`) — only when the user asks, existing contract.
