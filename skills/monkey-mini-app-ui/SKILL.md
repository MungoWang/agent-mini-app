---
name: monkey-mini-app-ui
description: >
  Build mini-apps and dashboards with @monkey-mini-app/ui.
  Trigger when writing or editing React UI for this host, internal tools,
  tables, dates, boards, editors, status, or shadcn-style screens.
---

# @monkey-mini-app/ui — mini-app guide

## Bootstrap

```tsx
import {
  UiProvider,
  AppShell, PageHeader, FilterBar,
  DataGrid, DateRangePicker, StatusBadge, StatCard,
} from "@monkey-mini-app/ui"
// Host already loads @monkey-mini-app/ui/globals.css once.

export function App() {
  return (
    <UiProvider locale="zh">
      <AppShell
        sidebar={/* nav */}
        header={<PageHeader title="Runs" description="CI last 24h" actions={/* … */} />}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard title="Pass" value="128" delta="+4" trend="up" />
          </div>
          <FilterBar>
            <DateRangePicker value={range} onChange={setRange} />
          </FilterBar>
          <DataGrid columns={columns} data={rows} pageSize={20} />
        </div>
      </AppShell>
    </UiProvider>
  )
}
```

- Import **from `@monkey-mini-app/ui` only** (engines already inside the package).
- `UiProvider locale="zh" | "en"` for chrome copy + date-fns locale.
- Layout spacing = Tailwind (`flex`, `grid`, `gap-*`, `p-4`). Shell pieces: `AppShell`, `PageHeader`, `FilterBar`, `DetailPanel`, `Resizable`.

## What exists

Generated index (names + when + link to props):

→ **[references/catalog.md](references/catalog.md)**

Per-component **props + related types** (e.g. `TimelineItem`, `KanbanCard`) + examples:

→ **[references/contracts/](references/contracts/)** e.g. `activity-feed.md`, `data-grid.md`

| Need | Reach for |
|---|---|
| Page shell | `AppShell` `PageHeader` `FilterBar` `DetailPanel` |
| KPI | `StatCard` `TrendCard` `StatusBadge` `SeverityChip` `EnvBadge` |
| Table | `DataGrid` + `ColumnDef` (re-exported) |
| Dates | `DatePicker` `DateRangePicker` `DateTimePicker` `DateTimeRangePicker` `TimePicker` `TimeRangePicker` `TimezoneSelect` `RelativeDatePicker` `DurationInput` |
| Board / plan | `Kanban` `EventCalendar` `Gantt` `Timeline` `Stepper` |
| Tree / list | `TreeView` `SortableList` `FileTree` |
| Editors | `RichTextEditor` `MarkdownEditor` `CodeEditor` `CodeBlock` |
| Inspect | `DiffViewer` `JsonViewer` `LogViewer` `RequestInspector` `Terminal` |
| Jira | `JiraWiki` `JqlInput` |
| Forms extras | `SearchInput` `NumberField` `TagInput` `UserPicker` `ConfirmDialog` `FileDropzone` `Copyable` … |
| Charts | `DonutChart` `StackedBarChart` `Sparkline` `Gauge` `RadarChart` + L1 `Chart` |
| Glue | L1 shadcn: `Button` `Input` `Select` `Dialog` `Sheet` `Tabs` `Card` `Sidebar` … |

## Compose patterns

**Filter + table**
```tsx
<FilterBar>
  <DateRangePicker value={range} onChange={setRange} />
  <SearchInput value={q} onChange={setQ} />
</FilterBar>
<DataGrid columns={columns} data={filtered} />
```

**DataGrid column**
```tsx
import { DataGrid, type ColumnDef, StatusBadge } from "@monkey-mini-app/ui"

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", meta: { sort: true, search: "text" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
]
// features default on: sorting, columnSearch, globalSearch, pagination, columnVisibility
// opt-in: rowSelection, columnResize, csvExport
```

**Master / detail**
```tsx
<DataGrid columns={columns} data={rows} /* row click → setId */ />
<DetailPanel open={!!id} onOpenChange={() => setId(null)} title={row?.name ?? ""}>
  {/* description list, activity, comments */}
</DetailPanel>
```

**Calendar / Kanban**
```tsx
<EventCalendar events={events} onEventsChange={setEvents} view="week" />
<Kanban columns={cols} cards={cards} onCardsChange={setCards} onCardClick={open} />
```

**Jira surfaces**
```tsx
<JqlInput value={jql} onChange={setJql} fields={fields} />
<JiraWiki classNames={{ heading: "text-base" }}>{wiki}</JiraWiki>
```

## How to pick a component

1. Open `references/catalog.md` — match the **when** column.
2. Open the linked `contracts/<slug>.md` for props + example.
3. Compose with Tailwind + L1; don’t reimplement dates/tables/boards.

## Regenerate contracts

Source of truth = component TS + JSDoc on the export:

```ts
/**
 * One-line summary.
 * @when Short cue for catalog
 * @example
 * <Foo bar={1} />
 */
export function Foo(...) {}
```

```bash
pnpm skill:gen
```

Writes `references/catalog.md`, `references/contracts/*.md`, `packages/ui/ai/catalog.json`.
