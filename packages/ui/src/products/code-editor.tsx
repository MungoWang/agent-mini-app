"use client"

import { useEffect, useRef, useState } from "react"

import { useHtmlDark } from "@monkey-mini-app/ui/hooks/use-html-dark"
import { cn } from "@monkey-mini-app/ui/lib/utils"

type LangS = "js" | "ts" | "json" | "html" | "md"

type EditorViewT = {
  destroy(): void
  dispatch(t: object): void
  state: { doc: { toString(): string; length: number } }
}

function bare<T extends object>(m: T & { default?: T }): T {
  return (m.default ?? m) as T
}

/**
 * Vanilla CodeMirror 6 loaded on demand from `esm.sh` (not npm, not a React wrapper).
 * Do not import `@codemirror/*` or `@uiw/react-codemirror` — the latter pulls a second React.
 * Highlighting needs `@codemirror/language` + a theme; lang packages only provide the parser.
 * If the CDN fails the host stays empty (no editor), rather than requiring a peer install.
 * @when Editing config/scripts in-app. Do not `import @codemirror/*` or add it to package.json.
 * @example
 * <CodeEditor value={src} language="ts" onChange={(v) => set(v)} />
 * @family Discovery & inspect
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
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorViewT | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value
  const [cm, setCm] = useState(false)
  const dark = useHtmlDark()

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const [viewMod, cmdMod, langMod, jsLang, jsonLang, htmlLang, mdLang, themeMod] = await Promise.all([
          import("https://esm.sh/@codemirror/view@6"),
          import("https://esm.sh/@codemirror/commands@6"),
          import("https://esm.sh/@codemirror/language@6"),
          import("https://esm.sh/@codemirror/lang-javascript@6"),
          import("https://esm.sh/@codemirror/lang-json@6"),
          import("https://esm.sh/@codemirror/lang-html@6"),
          import("https://esm.sh/@codemirror/lang-markdown@6"),
          import("https://esm.sh/@codemirror/theme-one-dark@6"),
        ])
        if (cancelled || !hostRef.current) return
        const viewNs = bare(
          viewMod as { EditorView: unknown; lineNumbers: () => unknown; keymap: { of: (k: unknown) => unknown } },
        )
        const cmdNs = bare(
          cmdMod as { defaultKeymap: unknown[]; history: () => unknown; historyKeymap: unknown[] },
        )
        const langNs = bare(
          langMod as {
            syntaxHighlighting: (s: unknown) => unknown
            defaultHighlightStyle: unknown
          },
        )
        const EditorView = viewNs.EditorView as {
          new (o: object): EditorViewT
          updateListener: { of: (fn: (u: { docChanged: boolean }) => void) => unknown }
          theme: (spec: Record<string, Record<string, string>>) => unknown
          darkTheme: { of: (v: boolean) => unknown }
        }
        const pick = (m: unknown, name: string): ((o?: object) => unknown) => {
          const n = bare(m as object & { default?: object }) as Record<string, unknown>
          const fn = n[name] ?? (n.default as Record<string, unknown> | undefined)?.[name]
          if (typeof fn !== "function") throw new Error(`lang ${name} missing`)
          return fn as (o?: object) => unknown
        }
        const langs: Record<string, unknown> = {
          js: pick(jsLang, "javascript")(),
          ts: pick(jsLang, "javascript")({ typescript: true }),
          json: pick(jsonLang, "json")(),
          html: pick(htmlLang, "html")(),
          md: pick(mdLang, "markdown")(),
        }
        const themeNs = bare(themeMod as { oneDark?: unknown; oneDarkHighlightStyle?: unknown })
        const chrome = EditorView.theme({
          "&": {
            backgroundColor: "transparent",
            color: "var(--foreground)",
            height: "100%",
          },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { caretColor: "var(--foreground)" },
          ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
          ".cm-gutters": {
            backgroundColor: "var(--muted)",
            color: "var(--muted-foreground)",
            border: "none",
          },
          ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--muted) 55%, transparent)" },
          ".cm-activeLineGutter": { backgroundColor: "var(--muted)" },
        })
        const highlight = dark
          ? (themeNs.oneDark ?? langNs.syntaxHighlighting(themeNs.oneDarkHighlightStyle ?? langNs.defaultHighlightStyle))
          : langNs.syntaxHighlighting(langNs.defaultHighlightStyle)
        const view = new EditorView({
          parent: hostRef.current,
          doc: valueRef.current,
          extensions: [
            viewNs.lineNumbers(),
            cmdNs.history(),
            langs[language] ?? langs.ts,
            EditorView.darkTheme.of(dark),
            highlight,
            chrome,
            viewNs.keymap.of([...(cmdNs.defaultKeymap ?? []), ...(cmdNs.historyKeymap ?? [])]),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onChangeRef.current?.(view.state.doc.toString())
            }),
          ],
        })
        viewRef.current = view
        setCm(true)
      } catch (err) {
        console.warn("[CodeEditor] CodeMirror CDN failed", err)
      }
    })()
    return () => {
      cancelled = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [language, dark])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (value === cur) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)}>
      {!cm && (
        <textarea
          data-testid="code-editor"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
          className="w-full resize-y overflow-auto bg-transparent px-3 py-2 font-mono text-xs leading-6 outline-none"
          style={{ height }}
        />
      )}
      <div
        ref={hostRef}
        data-testid={cm ? "code-editor" : undefined}
        className={cn(
          "text-xs leading-6 [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:h-full",
          !cm && "hidden",
        )}
        // Fixed height (not only minHeight) so CM's h-full resolves after async mount.
        style={{ height: cm ? height : undefined, minHeight: cm ? height : 0 }}
      />
    </div>
  )
}
