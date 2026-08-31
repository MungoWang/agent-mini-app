"use client"

import { useEffect, useState } from "react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

type LangS = "js" | "ts" | "json" | "html" | "md"

/**
 * Code editor. codemirror is heavy + rarely used, so it's loaded from a CDN on
 * demand. We render a native <textarea> first (immediately editable), then swap
 * to the real editor once codemirror has loaded. If the CDN is unavailable we
 * stay on the textarea (edit-anywhere still works).
 */
export function CodeEditor({
  value,
  onChange,
  language = "ts",
  height = "220px",
  className,
}: {
  value: string
  onChange?: (value: string) => void
  language?: LangS
  height?: string
  className?: string
}) {
  const [cm, setCm] = useState<{ CodeMirror: any; langs: Record<string, any>; oneDark: any } | null>(null)
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cmi, js, json, html, md, theme] = await Promise.all([
          import("https://esm.run/@uiw/react-codemirror@4.25.11"),
          import("https://esm.run/@codemirror/lang-javascript@6.2.5"),
          import("https://esm.run/@codemirror/lang-json@6.0.2"),
          import("https://esm.run/@codemirror/lang-html@6.4.12"),
          import("https://esm.run/@codemirror/lang-markdown@6.5.2"),
          import("https://esm.run/@codemirror/theme-one-dark@6.1.3"),
        ])
        if (cancelled) return
        setCm({
          CodeMirror: (cmi as any).default,
          langs: {
            js: js.javascript(),
            ts: js.javascript({ typescript: true }),
            json: json.json(),
            html: html.html(),
            md: md.markdown(),
          },
          oneDark: theme.oneDark,
        })
      } catch {
        // CDN unavailable → stay on the native <textarea>.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!cm) {
    return (
      <textarea
        data-testid="code-editor"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
        className={cn("w-full resize-y overflow-auto rounded-xl border bg-card px-3 py-2 font-mono text-xs leading-6 outline-none", className)}
        style={{ height }}
      />
    )
  }

  const { CodeMirror, langs, oneDark } = cm
  return (
    <div data-testid="code-editor" className={cn("overflow-hidden rounded-xl border", className)}>
      <CodeMirror
        value={value}
        height={height}
        theme={dark ? oneDark : "light"}
        extensions={[langs[language] ?? langs.ts]}
        onChange={(next: string) => onChange?.(next)}
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  )
}
