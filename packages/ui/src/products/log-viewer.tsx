"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import * as React from "react"

export function LogViewer({ lines }: { lines: string[] }) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 12,
  })
  return (
    <div
      ref={parentRef}
      data-testid="log-viewer"
      className="h-64 overflow-auto rounded-xl border bg-card font-mono text-xs"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            className="absolute left-0 w-full truncate px-3"
            style={{ top: item.start, height: item.size }}
          >
            {lines[item.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
