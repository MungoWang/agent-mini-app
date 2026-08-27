"use client"

import * as React from "react"

function Node({ label, value, depth }: { label?: string; value: unknown; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2)
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button type="button" className="text-left font-mono text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "▾" : "▸"} {label ? `${label}: ` : ""}
          {Array.isArray(value) ? `Array(${entries.length})` : "Object"}
        </button>
        {open
          ? entries.map(([key, child]) => (
              <Node key={key} label={key} value={child} depth={depth + 1} />
            ))
          : null}
      </div>
    )
  }
  return (
    <div className="font-mono text-xs" style={{ paddingLeft: depth * 12 }}>
      {label ? `${label}: ` : ""}
      <span className="text-muted-foreground">{JSON.stringify(value)}</span>
    </div>
  )
}

export function JsonViewer({ value }: { value: unknown }) {
  return (
    <div data-testid="json-viewer" className="rounded-xl border bg-card p-3">
      <Node value={value} depth={0} />
    </div>
  )
}
