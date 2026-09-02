"use client"

import * as React from "react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { CodeEditor } from "@monkey-mini-app/ui/products/code-editor"
import { Markdown } from "@monkey-mini-app/ui/products/markdown"
import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type MarkdownEditorMode = "edit" | "split" | "preview"

/**
 * Markdown edit + preview toggle.
 * @when Authoring md bodies. Read-only render → `Markdown`.
 * @example
 * <MarkdownEditor value={md} onChange={(v) => set(v)} />
 * @family Rich text
 */
export function MarkdownEditor({
  value,
  onChange,
  mode = "split",
  onModeChange,
}: {
  value: string
  onChange?: (value: string) => void
  mode?: MarkdownEditorMode
  onModeChange?: (mode: MarkdownEditorMode) => void
}) {
  const t = useLabels("markdownEditor")
  const [currentMode, setCurrentMode] = React.useState<MarkdownEditorMode>(mode)
  React.useEffect(() => setCurrentMode(mode), [mode])
  const setMode = (next: MarkdownEditorMode) => {
    setCurrentMode(next)
    onModeChange?.(next)
  }
  return (
    <div data-testid="markdown-editor" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-1 border-b p-1">
        {(["edit", "split", "preview"] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={currentMode === item ? "default" : "ghost"}
            data-testid={`markdown-mode-${item}`}
            onClick={() => setMode(item)}
          >
            {t[item]}
          </Button>
        ))}
      </div>
      <div
        className={cn(
          "grid min-h-[280px]",
          currentMode === "split" ? "md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {currentMode !== "preview" ? (
          <div className={cn(currentMode === "split" && "border-b md:border-r md:border-b-0")}>
            <CodeEditor
              value={value}
              onChange={onChange}
              language="md"
              height="280px"
              className="rounded-none border-0"
            />
          </div>
        ) : null}
        {currentMode !== "edit" ? (
          <div className="overflow-auto p-3" data-testid="markdown-preview">
            <Markdown>{value}</Markdown>
          </div>
        ) : null}
      </div>
    </div>
  )
}
