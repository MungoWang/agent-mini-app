"use client"

import { oneDark } from "@codemirror/theme-one-dark"
import { autocompletion } from "@codemirror/autocomplete"
import CodeMirror from "@uiw/react-codemirror"

import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import {
  defaultJqlFields,
  defaultJqlFunctions,
  jqlCompletion,
  jqlLanguage,
  type JqlSuggestItem,
} from "./jql-language"

/**
 * CodeMirror JQL editor with field/function completion (host injects fields).
 * @when Issue search / saved filters
 * @example
 * <JqlInput value={jql} onChange={setJql} fields={[{ name: "status" }]} />
 */
export function JqlInput({
  value,
  onChange,
  fields = defaultJqlFields,
  functions = defaultJqlFunctions,
  height = "88px",
  className,
}: {
  value: string
  onChange?: (value: string) => void
  fields?: JqlSuggestItem[]
  functions?: JqlSuggestItem[]
  height?: string
  className?: string
}) {
  const t = useLabels("jqlInput")
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  return (
    <div data-testid="jql-input" className={cn("overflow-hidden rounded-xl border", className)}>
      <CodeMirror
        value={value}
        height={height}
        theme={dark ? oneDark : "light"}
        placeholder={t.placeholder}
        extensions={[
          jqlLanguage,
          autocompletion({ override: [jqlCompletion(fields, functions)] }),
        ]}
        onChange={(next) => onChange?.(next)}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
      />
    </div>
  )
}

export { defaultJqlFields, defaultJqlFunctions } from "./jql-language"
export type { JqlSuggestItem }
