import * as React from "react"
import { Button } from "@monkey-mini-app/ui/components/button"
import { CodeEditor } from "@monkey-mini-app/ui/products/code-editor"
import { DiffViewer } from "@monkey-mini-app/ui/products/diff-viewer"
import { MarkdownEditor } from "@monkey-mini-app/ui/products/markdown-editor"
import { RichTextEditor } from "@monkey-mini-app/ui/products/rich-text-editor"
import { JiraWiki, JqlInput } from "@monkey-mini-app/ui"
import { Textarea } from "@monkey-mini-app/ui/components/textarea"
import { Example } from "./section"
import { JIRA_WIKI_SAMPLE } from "./jira-wiki-sample"

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
}

function DiffPlayground() {
  const files = Object.keys(DIFFS) as (keyof typeof DIFFS)[]
  const [file, setFile] = React.useState<(typeof files)[number]>(files[0])
  const [mode, setMode] = React.useState<"unified" | "split">("unified")
  const current = DIFFS[file]
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
  )
}

export function EditorExamples() {
  const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>")
  const [code, setCode] = React.useState("export const n = 1\n")
  const [md, setMd] = React.useState(
    "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n"
  )
  const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split")
  const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC')
  const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE)

  return (
    <>
      <Example id="rich-text-editor" title="RichTextEditor" hint="Tiptap — toolbar is live">
        <RichTextEditor value={html} onChange={setHtml} />
      </Example>
      <Example id="code-editor" title="CodeEditor" hint="CodeMirror 6">
        <CodeEditor value={code} onChange={setCode} language="ts" />
      </Example>
      <Example
        id="markdown-editor"
        title="MarkdownEditor"
        hint="Left CodeMirror, right live GFM preview"
      >
        <MarkdownEditor value={md} onChange={setMd} mode={mdMode} onModeChange={setMdMode} />
      </Example>
      <Example id="diff-viewer" title="DiffViewer" hint="PR-style hunks, line numbers, unified/split">
        <DiffPlayground />
      </Example>
      <Example id="jira-wiki" title="JiraWiki" hint="Left markup, right live preview">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid min-h-[280px] md:grid-cols-2">
            <Textarea
              value={wiki}
              onChange={(event) => setWiki(event.target.value)}
              spellCheck={false}
              className="min-h-[280px] resize-none rounded-none border-0 border-b font-mono md:border-r md:border-b-0"
            />
            <div className="overflow-auto p-3">
              <JiraWiki>{wiki}</JiraWiki>
            </div>
          </div>
        </div>
      </Example>
      <Example id="jql-input" title="JqlInput" hint="CodeMirror JQL · type to complete fields">
        <JqlInput value={jql} onChange={setJql} />
        <p className="text-muted-foreground mt-2 font-mono text-xs">{jql}</p>
      </Example>
    </>
  )
}
