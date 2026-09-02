"use client"

import { useEffect, useState } from "react"
import { diffLines } from "diff"

import { useHtmlDark } from "@monkey-mini-app/ui/hooks/use-html-dark"
import { cn } from "@monkey-mini-app/ui/lib/utils"

type Row = {
  type: "equal" | "add" | "del"
  text: string
  left?: number
  right?: number
}

type Token = { content: string; color?: string }

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function lineToHtml(tokens: Token[]): string {
  return tokens
    .map((t) =>
      t.color
        ? `<span style="color:${escapeHtml(t.color)}">${escapeHtml(t.content)}</span>`
        : escapeHtml(t.content),
    )
    .join("")
}

function langFromFile(name?: string): string {
  const ext = name?.split(".").pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    jsx: "jsx",
    json: "json",
    html: "html",
    md: "md",
    css: "css",
  }
  return (ext && map[ext]) || "ts"
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
  html,
}: {
  row: Row
  side?: "left" | "right"
  html?: string
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
        !hidden && row.type === "add" && "bg-emerald-500/15",
        !hidden && row.type === "del" && "bg-destructive/10",
        !html && !hidden && row.type === "add" && "text-emerald-800 dark:text-emerald-300",
        !html && !hidden && row.type === "del" && "text-destructive",
      )}
    >
      {side !== "right" ? <Gutter n={hidden ? undefined : row.left} /> : null}
      {side !== "left" ? <Gutter n={hidden ? undefined : row.right} /> : null}
      <span className="w-4 shrink-0 select-none">{hidden ? " " : mark}</span>
      {hidden ? (
        <span className="min-w-0 flex-1" />
      ) : html ? (
        <span
          className="min-w-0 flex-1 whitespace-pre-wrap break-all"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{row.text}</span>
      )}
    </div>
  )
}

/**
 * Unified or split diff view.
 * @when Comparing two versions of text. Pass `original` + `modified` strings.
 * @example
 * <DiffViewer original={a} modified={b} language="ts" mode="split" />
 * @family Discovery & inspect
 */
export function DiffViewer({
  original,
  modified,
  mode = "unified",
  fileName,
  language,
}: {
  original: string
  modified: string
  mode?: "unified" | "split"
  fileName?: string
  language?: string
}) {
  const rows = toRows(original, modified)
  const { added, removed } = stats(rows)
  const lang = language ?? langFromFile(fileName)
  const [hi, setHi] = useState<{ orig: string[]; mod: string[] } | null>(null)
  const dark = useHtmlDark()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const shiki = (await import("https://esm.sh/shiki@4.4.3")) as {
          codeToTokens?: (code: string, opts: object) => Promise<{ tokens: Token[][] }>
          default?: { codeToTokens?: (code: string, opts: object) => Promise<{ tokens: Token[][] }> }
        }
        const codeToTokens = shiki.codeToTokens ?? shiki.default?.codeToTokens
        if (!codeToTokens) throw new Error("shiki.codeToTokens missing")
        const theme = dark ? "github-dark" : "github-light"
        const [a, b] = await Promise.all([
          codeToTokens(original, { lang, theme }),
          codeToTokens(modified, { lang, theme }),
        ])
        if (cancelled) return
        setHi({
          orig: a.tokens.map(lineToHtml),
          mod: b.tokens.map(lineToHtml),
        })
      } catch (err) {
        console.warn("[DiffViewer] shiki CDN failed", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [original, modified, lang, dark])

  function htmlFor(row: Row): string | undefined {
    if (!hi) return undefined
    if (row.type === "del") return hi.orig[(row.left ?? 1) - 1]
    if (row.type === "add") return hi.mod[(row.right ?? 1) - 1]
    return hi.orig[(row.left ?? 1) - 1] ?? hi.mod[(row.right ?? 1) - 1]
  }

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
              <Line key={`l${index}`} row={row} side="left" html={htmlFor(row)} />
            ))}
          </div>
          <div>
            {rows.map((row, index) => (
              <Line key={`r${index}`} row={row} side="right" html={htmlFor(row)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          {rows.map((row, index) => (
            <Line key={index} row={row} html={htmlFor(row)} />
          ))}
        </div>
      )}
    </div>
  )
}
