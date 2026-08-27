import { Avatar, AvatarFallback } from "@monkey-mini-app/ui/components/avatar"
import { Progress } from "@monkey-mini-app/ui/components/progress"
import { StatusBadge } from "@monkey-mini-app/ui/blocks/status-badge"
import { DataGrid, type ColumnDef } from "@monkey-mini-app/ui/products/data-grid"
import { Example } from "./section"

type Run = { id: string; name: string; owner: string; duration: string; status: string }

const runs: Run[] = [
  { id: "1", name: "login-spec", owner: "Ada", duration: "1.2s", status: "pass" },
  { id: "2", name: "checkout-spec", owner: "Lin", duration: "4.8s", status: "fail" },
  { id: "3", name: "search-spec", owner: "Ada", duration: "0.9s", status: "pass" },
  { id: "4", name: "upload-spec", owner: "Kai", duration: "12.0s", status: "blocked" },
  { id: "5", name: "grid-spec", owner: "Lin", duration: "3.1s", status: "flaky" },
  { id: "6", name: "auth-spec", owner: "Kai", duration: "2.0s", status: "running" },
]

const columns: ColumnDef<Run>[] = [
  { accessorKey: "name", header: "Name", meta: { sort: true, search: "text" } },
  { accessorKey: "owner", header: "Owner", meta: { sort: true, search: "text" } },
  { accessorKey: "duration", header: "Duration", meta: { sort: true, search: "text" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
]

type Ticket = {
  id: string
  key: string
  title: string
  owner: string
  progress: number
  status: string
}

const tickets: Ticket[] = [
  { id: "1", key: "TMS-1201", title: "Grid sort reset", owner: "Ada", progress: 80, status: "pass" },
  { id: "2", key: "TMS-1208", title: "Kanban details", owner: "Lin", progress: 45, status: "running" },
  { id: "3", key: "TMS-1210", title: "Calendar views", owner: "Kai", progress: 20, status: "blocked" },
  { id: "4", key: "TMS-1214", title: "Markdown split", owner: "Ada", progress: 100, status: "pass" },
]

const ticketColumns: ColumnDef<Ticket>[] = [
  {
    accessorKey: "key",
    header: "Key",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{String(getValue())}</span>
    ),
  },
  { accessorKey: "title", header: "Title", meta: { sort: true, search: "text" } },
  {
    accessorKey: "owner",
    header: "Owner",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => {
      const name = String(getValue())
      return (
        <span className="inline-flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {name}
        </span>
      )
    },
  },
  {
    accessorKey: "progress",
    header: "Progress",
    meta: { sort: true, search: "none" },
    cell: ({ getValue }) => (
      <div className="w-28">
        <Progress value={Number(getValue())} />
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
]

export function DataExamples() {
  return (
    <>
      <Example id="data-grid" title="DataGrid" hint="Sort cycles asc → desc → none">
        <DataGrid columns={columns} data={runs} pageSize={4} searchPlaceholder="Search runs…" />
      </Example>
      <Example
        id="data-grid-custom"
        title="DataGrid · custom cells"
        hint="Avatar, progress, badges, row expand, selection, CSV"
      >
        <DataGrid
          columns={ticketColumns}
          data={tickets}
          pageSize={10}
          features={{ rowSelection: true, csvExport: true }}
          searchPlaceholder="Search tickets…"
          renderExpanded={(row) => (
            <div className="text-sm">
              <span className="font-mono text-muted-foreground">{row.key}</span>
              {" — "}
              {row.title} assigned to {row.owner}
            </div>
          )}
        />
      </Example>
    </>
  )
}
