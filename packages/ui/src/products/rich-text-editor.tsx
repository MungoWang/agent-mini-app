"use client"

import * as React from "react"
import { Bold, Code, Italic, List, ListOrdered } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

function runCommand(command: string, value?: string) {
  // Same primitive as react-simple-wysiwyg. Deprecated, still what lightweight
  // browsers expose for simple WYSIWYG; no TipTap / CDN / second React.
  document.execCommand(command, false, value)
}

/**
 * Lightweight rich-text editor (contentEditable + toolbar), same idea as
 * `react-simple-wysiwyg`. HTML is browser-generated — sanitize server-side if needed.
 * @family Rich text
 * @when Notes/descriptions you store as **HTML**. Markdown → `MarkdownEditor`; code → `CodeEditor`. Sanitize server-side before rendering elsewhere.
 */
export function RichTextEditor({
  value = "<p></p>",
  onChange,
  placeholder,
}: {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
}) {
  const t = useLabels("richText")
  const ref = React.useRef<HTMLDivElement>(null)
  const ph = placeholder ?? t.placeholder

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.innerHTML !== value) el.innerHTML = value || ""
  }, [value])

  const emit = () => {
    onChange?.(ref.current?.innerHTML ?? "")
  }

  const cmd = (command: string, arg?: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    ref.current?.focus()
    runCommand(command, arg)
    emit()
  }

  return (
    <div data-testid="rich-text-editor" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap gap-0.5 border-b p-1">
        <Button type="button" size="sm" variant="ghost" aria-label={t.bold} onMouseDown={cmd("bold")}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-label={t.italic} onMouseDown={cmd("italic")}>
          <Italic className="size-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-label={t.code} onMouseDown={cmd("formatBlock", "pre")}>
          <Code className="size-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-label={t.bullet} onMouseDown={cmd("insertUnorderedList")}>
          <List className="size-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-label={t.ordered} onMouseDown={cmd("insertOrderedList")}>
          <ListOrdered className="size-3.5" />
        </Button>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={ph}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={ph}
        className={cn(
          "min-h-40 px-3 py-2 text-sm outline-none",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:px-2 [&_pre]:py-1 [&_pre]:font-mono [&_pre]:text-xs",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        )}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  )
}
