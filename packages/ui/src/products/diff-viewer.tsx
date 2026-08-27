"use client"

import { diffLines } from "diff"

import { cn } from "@monkey-mini-app/ui/lib/utils"

type Row = {
  type: "equal" | "add" | "del"
  text: string
  left?: number
  right?: number
}

function toRows(original: string, modified: string): Row[] {
  const parts = diffLines(original, modified)
  const rows: Row[] = []
  let left = 1
  let right = 1
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n")
    for (const text of lines) {
      if (part.added) {
        rows.push({ type: "add", text, right: right++ })
      } else if (part.removed) {
        rows.push({ type: "del", text, left: left++ })
      } else {
        rows.push({ type: "equal", text, left: left++, right: right++ })
      }
    }
  }
  return rows
}

function stats(rows: Row[]) {
  return {
    added: rows.filter((row) => row.type === "add").length,
    removed: rows.filter((row) => row.type === "del").length,
  }
}

function Gutter({ n }: { n?: number }) {
  return (
    <span className="w-8 shrink-0 pr-2 text-right text-[11px] text-muted-foreground/70 select-none">
      {n ?? ""}
    </span>
  )
}

function Line({
  row,
  side,
}: {
  row: Row
  side?: "left" | "right"
}) {
  const hidden =
    (side === "left" && row.type === "add") ||
    (side === "right" && row.type === "del")
  const mark = row.type === "add" ? "+" : row.type === "del" ? "-" : " "
  return (
    <div
      className={cn(
        "flex px-2",
        hidden && "bg-muted/40",
        !hidden && row.type === "add" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
        !hidden && row.type === "del" && "bg-destructive/10 text-destructive"
      )}
    >
      {side !== "right" ? <Gutter n={hidden ? undefined : row.left} /> : null}
      {side !== "left" ? <Gutter n={hidden ? undefined : row.right} /> : null}
      <span className="w-4 shrink-0 select-none">{hidden ? " " : mark}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
        {hidden ? "" : row.text}
      </span>
    </div>
  )
}

export function DiffViewer({
  original,
  modified,
  mode = "unified",
  fileName,
}: {
  original: string
  modified: string
  mode?: "unified" | "split"
  fileName?: string
}) {
  const rows = toRows(original, modified)
  const { added, removed } = stats(rows)

  return (
    <div
      data-testid="diff-viewer"
      data-mode={mode}
      className="overflow-hidden rounded-xl border bg-card font-mono text-xs leading-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="truncate text-muted-foreground">{fileName ?? "diff"}</span>
        <span className="tabular-nums">
          <span className="text-emerald-700 dark:text-emerald-400">+{added}</span>
          {" "}
          <span className="text-destructive">-{removed}</span>
        </span>
      </div>
      {mode === "split" ? (
        <div className="grid max-h-[28rem] grid-cols-2 overflow-auto">
          <div className="border-r">
            {rows.map((row, index) => (
              <Line key={`l${index}`} row={row} side="left" />
            ))}
          </div>
          <div>
            {rows.map((row, index) => (
              <Line key={`r${index}`} row={row} side="right" />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          {rows.map((row, index) => (
            <Line key={index} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
