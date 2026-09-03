/**
 * @group editors
 * @title DiffViewer
 * @scenario DiffViewer driven by app state — switch files and unified/split mode from a toolbar, the shape of a PR review screen.
 * @hint PR-style hunks, line numbers, unified/split
 */
import * as React from "react";

import { Button, DiffViewer } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
    "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n"
  );

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

const DIFFS = {
  "src/products/data-grid.tsx": {
    original: `export function DataGrid({ columns, data }) {
  const [sorting, setSorting] = React.useState([])
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <Table>
        <TableHeader>{/* headers */}</TableHeader>
        <TableBody>{/* rows */}</TableBody>
      </Table>
    </div>
  )
}
`,
    modified: `export function DataGrid({ columns, data, features }) {
  const [sorting, setSorting] = React.useState([])
  const [columnFilters, setColumnFilters] = React.useState([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div data-testid="data-grid">
      <Toolbar table={table} />
      <Table>
        <TableHeader>{/* sortable headers */}</TableHeader>
        <TableBody>{/* virtualized rows */}</TableBody>
      </Table>
      <Pagination table={table} />
    </div>
  )
}
`,
  },
  "src/products/kanban.tsx": {
    original: `export type KanbanCard = {
  id: string
  title: string
  columnId: string
}
`,
    modified: `export type KanbanCard = {
  id: string
  title: string
  columnId: string
  key?: string
  assignee?: string
  tags?: string[]
  priority?: string
  comments?: KanbanComment[]
}
`,
  },
};

function DiffPlayground() {
  const files = Object.keys(DIFFS) as (keyof typeof DIFFS)[];
  const [file, setFile] = React.useState<(typeof files)[number]>(files[0]);
  const [mode, setMode] = React.useState<"unified" | "split">("unified");
  const current = DIFFS[file];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {files.map((name) => (
          <Button
            key={name}
            size="sm"
            variant={file === name ? "default" : "outline"}
            onClick={() => setFile(name)}
          >
            {name.split("/").at(-1)}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          data-testid="diff-mode-toggle"
          onClick={() => setMode((m) => (m === "unified" ? "split" : "unified"))}
        >
          {mode}
        </Button>
      </div>
      <DiffViewer
        fileName={file}
        original={current.original}
        modified={current.modified}
        mode={mode}
      />
    </div>
  );
}

export default function MiscEditors01Example() {
  return (
    <DiffPlayground />
  );
}
