"use client"

import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type JqlSuggestItem = { name: string; type?: string }

/**
 * JQL query textbox. Native textarea by default (no CodeMirror npm/peer).
 * Callers who want completion can swap in `CodeEditor` (CM6 from esm.sh).
 * @when Issue search / saved filters
 * @example
 * <JqlInput value={jql} onChange={setJql} />
 * @family Form
 */
export function JqlInput({
  value,
  onChange,
  className,
  height = "88px",
}: {
  value: string
  onChange?: (value: string) => void
  className?: string
  height?: string
}) {
  const t = useLabels("jqlInput")
  return (
    <textarea
      data-testid="jql-input"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={t.placeholder}
      spellCheck={false}
      className={cn("w-full resize-y overflow-auto rounded-xl border bg-card px-3 py-2 font-mono text-xs leading-6 outline-none", className)}
      style={{ height }}
    />
  )
}
