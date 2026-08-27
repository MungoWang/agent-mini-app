"use client"

import { html } from "@codemirror/lang-html"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { oneDark } from "@codemirror/theme-one-dark"
import CodeMirror from "@uiw/react-codemirror"

import { cn } from "@monkey-mini-app/ui/lib/utils"

const langs = {
  js: javascript(),
  ts: javascript({ typescript: true }),
  json: json(),
  html: html(),
  md: markdown(),
}

export function CodeEditor({
  value,
  onChange,
  language = "ts",
  height = "220px",
  className,
}: {
  value: string
  onChange?: (value: string) => void
  language?: keyof typeof langs
  height?: string
  className?: string
}) {
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  return (
    <div data-testid="code-editor" className={cn("overflow-hidden rounded-xl border", className)}>
      <CodeMirror
        value={value}
        height={height}
        theme={dark ? oneDark : "light"}
        extensions={[langs[language] ?? langs.ts]}
        onChange={(next) => onChange?.(next)}
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  )
}
