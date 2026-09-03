"use client"

import { useEffect, useRef, useState } from "react"

import { useHtmlDark } from "@monkey-mini-app/ui/hooks/use-html-dark"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export type JqlSuggestItem = { name: string; type?: string }

/** JQL words that are never a field name or a value. */
const KEYWORDS = [
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "EMPTY",
  "NULL",
  "WAS",
  "CHANGED",
  "ON",
  "BY",
  "ORDER",
  "GROUP",
  "ASC",
  "DESC",
  "BEFORE",
  "AFTER",
  "DURING",
  "FOLLOWED",
  "TO",
  "FROM",
]

const OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "~", "!~"]

/** Words that start a clause, so `ORDER` + `BY` completes as one pair. */
const PHRASES = ["ORDER BY", "GROUP BY", "IS EMPTY", "IS NOT NULL", "FOLLOWED BY", "CHANGED ON", "WAS BEFORE", "IN ("]

const FUNCTIONS = [
  "now()",
  "startOfDay()",
  "startOfWeek()",
  "startOfMonth()",
  "startOfQuarter()",
  "startOfYear()",
  "-1d",
  "-7d",
  "+2w",
]

function bare<T extends object>(m: T & { default?: T }): T {
  return (m.default ?? m) as T
}

type CmCore = {
  EditorView: any
  keymap: any
  placeholder: any
  syntaxHighlighting: any
  HighlightStyle: any
  StreamLanguage: any
  autocompletion: any
  completionKeymap: any
  tags: any
  EditorState: any
}

/** CodeMirror 6 core, loaded once per page (esm.sh, never npm). */
let corePromise: Promise<CmCore> | null = null
function loadCore(): Promise<CmCore> {
  corePromise ??= (async () => {
    const [viewMod, stateMod, langMod, acMod, tagsMod] = await Promise.all([
      import("https://esm.sh/@codemirror/view@6"),
      import("https://esm.sh/@codemirror/state@6"),
      import("https://esm.sh/@codemirror/language@6"),
      import("https://esm.sh/@codemirror/autocomplete@6"),
      import("https://esm.sh/@lezer/highlight@1"),
    ])
    const view = bare(viewMod as any)
    const state = bare(stateMod as any)
    const lang = bare(langMod as any)
    const ac = bare(acMod as any)
    const hl = bare(tagsMod as any)
    return {
      EditorView: view.EditorView,
      keymap: view.keymap,
      placeholder: view.placeholder,
      EditorState: state.EditorState,
      syntaxHighlighting: lang.syntaxHighlighting,
      HighlightStyle: lang.HighlightStyle,
      StreamLanguage: lang.StreamLanguage,
      autocompletion: ac.autocompletion,
      completionKeymap: ac.completionKeymap,
      tags: hl.tags,
    }
  })().catch((err) => {
    corePromise = null
    throw err
  })
  return corePromise
}

/**
 * Stream tokenizer: `"quoted"` / `'quoted'`, numbers, dates, relative intervals,
 * operators, keywords, then a word is a **field** when an operator follows it.
 */
function jqlLanguage(core: CmCore) {
  const kw = new Set(KEYWORDS)
  return core.StreamLanguage.define({
    name: "jql",
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/^'[^']*'/) || stream.match(/^"[^"]*"/)) return "string"
      if (stream.match(/^[+-]?\d+(h|d|w|mo|q|y)\b/)) return "number"
      if (stream.match(/^\d{4}-\d{2}-\d{2}/)) return "number"
      if (stream.match(/^[+-]?\d+(\.\d+)?/)) return "number"
      if (stream.match(/^(!=|>=|<=|!~|=|>|<|~)/)) return "operator"
      if (stream.match(/^[,()[\]]/)) return "operator"
      const word = stream.match(/^[A-Za-z_][\w.()-]*/)
      if (word) {
        const raw = String(word[0])
        if (kw.has(raw.toUpperCase())) return "keyword"
        const followedByOp =
          stream.match(/^\s*(=|!=|>=|<=|>|<|~|!~)/, false) ||
          stream.match(/^\s*(IN|IS|WAS|CHANGED|FOLLOWED|ORDER|GROUP)\b/i, false)
        return followedByOp ? "property" : "value"
      }
      if (stream.match(/^[^\s]+/)) return "value"
      stream.next()
      return null
    },
  })
}

/** Token classes are coloured from CSS vars so light/dark and palettes apply. */
function jqlHighlight(core: CmCore) {
  const { tags } = core
  return core.HighlightStyle.define([
    { tag: tags.keyword, class: "cm-jql-kw" },
    { tag: tags.propertyName, class: "cm-jql-prop" },
    { tag: tags.string, class: "cm-jql-str" },
    { tag: tags.number, class: "cm-jql-num" },
    { tag: tags.operator, class: "cm-jql-op" },
  ])
}

function jqlTheme(core: CmCore, dark: boolean) {
  return core.EditorView.theme({
    "&": { backgroundColor: "transparent", color: "var(--foreground)", height: "100%" },
    ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono, ui-monospace, monospace)" },
    ".cm-content": { caretColor: "var(--foreground)", padding: "8px 12px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: dark ? "rgba(99,130,255,.32)" : "color-mix(in oklch, var(--primary) 22%, transparent)",
    },
    ".cm-jql-kw": { color: "var(--primary)", fontWeight: "600" },
    ".cm-jql-prop": { color: "var(--foreground)", fontWeight: "600" },
    ".cm-jql-str": { color: "var(--chart-2)" },
    ".cm-jql-num": { color: "var(--chart-3)" },
    ".cm-jql-op": { color: "var(--muted-foreground)" },
    // Completion pop-up follows the panel tokens instead of CM's defaults.
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      color: "var(--popover-foreground)",
      fontSize: "12px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)",
      color: "var(--popover-foreground)",
    },
  })
}

type Opt = { label: string; detail?: string; type?: string; boost?: number }

function optionFor(name: string, kind: string): Opt {
  return { label: name, type: kind }
}

/**
 * Field names → operators → values, based on what precedes the cursor.
 */
function complete(core: CmCore, fields: JqlSuggestItem[]) {
  const fieldNames = fields.map((f) => f.name)
  const byName = new Map(fields.map((f) => [f.name, f]))
  const WORD = /([\w."'-]*)$/

  return (ctx: any) => {
    const before = ctx.state.doc.sliceString(0, ctx.pos)
    const word = String(WORD.exec(before)?.[0] ?? "")
    const from = ctx.pos - word.length
    const clause = before.slice(before.lastIndexOf("\n") + 1)
    const options: Opt[] = []

    // `field <op> ` → values for that field (plus functions and phrases).
    const assign = /([\w.]+)\s*(=|!=|>=|<=|>|<|~|!~|IS|IN|WAS)\s*$/i.exec(clause)
    if (assign) {
      const name = assign[1]
      if (byName.has(name)) {
        // quoted literal first, then the values worth trying for this field
        options.push({ label: '\"...\"', detail: "literal", type: "text", boost: 999 })
        for (const v of sampleValues(name)) options.push({ label: v, detail: name, type: "value", boost: 500 })
      }
      for (const fn of FUNCTIONS) options.push({ label: fn, detail: "jql value", type: "function", boost: 400 })
      return { from, options, validFor: /^[\w."'-]*$/ }
    }

    // Just typed a field name → offer operators.
    if (/([\w.]+)\s*$/i.test(clause) && !/\s(and|or|not|by|in|is|was)$/i.test(clause)) {
      for (const op of OPERATORS) options.push({ label: op, type: "operator", boost: 600 })
    }

    // Otherwise: fields and clause keywords.
    for (const f of fieldNames) options.push(optionFor(f, "property"))
    for (const p of PHRASES) options.push({ label: p, type: "keyword", boost: -100 })
    for (const k of KEYWORDS) options.push({ label: k, type: "keyword", boost: -200 })
    return { from, options, validFor: /^[\w."'-]*$/ }
  }
}

/** Values worth offering per field — real installs would fetch these from the backend. */
function sampleValues(field: string): string[] {
  const table: Record<string, string[]> = {
    status: ["Open", "In Progress", "Blocked", "Done"],
    assignee: ["currentUser()", "pwang12", "unassigned"],
    reporter: ["currentUser()"],
    priority: ["Blocker", "Critical", "Major", "Minor", "Trivial"],
    resolution: ["Done", "Won't Do", "Duplicate"],
    issuetype: ["Bug", "Task", "Story", "Sub-task"],
    labels: ["cn", "stg", "hotfix"],
    project: ["TMS", "GLS", "LMA"],
  }
  return table[field.toLowerCase()] ?? []
}

/**
 * JQL query field: CodeMirror 6 (esm.sh, on demand) with syntax highlighting and
 * field/operator/value completion that opens as you type. Falls back to a plain
 * textarea when the CDN is unreachable — the query still edits.
 * @when Issue search / saved filters. Needs a real field list: pass `fields`.
 * @example
 * <JqlInput value={jql} onChange={setJql} fields={[{ name: "status" }, { name: "assignee" }]} />
 * @family Form
 */
export function JqlInput({
  value,
  onChange,
  fields = [],
  className,
  height = "88px",
}: {
  value: string
  onChange?: (value: string) => void
  /** Field names offered by completion (from your JQL backend). */
  fields?: JqlSuggestItem[]
  className?: string
  height?: string
}) {
  const t = useLabels("jqlInput")
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const [cm, setCm] = useState(false)
  const dark = useHtmlDark()

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const core = await loadCore()
        if (cancelled || !hostRef.current) return
        const view = new core.EditorView({
          parent: hostRef.current,
          doc: valueRef.current,
          extensions: [
            core.EditorView.lineWrapping,
            jqlLanguage(core),
            core.syntaxHighlighting(jqlHighlight(core)),
            core.EditorView.darkTheme.of(dark),
            jqlTheme(core, dark),
            core.placeholder(t.placeholder),
            core.autocompletion({
              activateOnTyping: true,
              icons: false,
              defaultTable: undefined,
              override: [complete(core, fieldsRef.current)],
            }),
            core.keymap.of(core.completionKeymap),
            core.EditorView.updateListener.of((u: any) => {
              if (u.docChanged) onChangeRef.current?.(view.state.doc.toString())
            }),
          ],
        })
        viewRef.current = view
        setCm(true)
      } catch (err) {
        // CDN down or build failure: the textarea fallback still edits the query.
        console.warn("[JqlInput] CodeMirror unavailable, using plain textarea", err)
      }
    })()
    return () => {
      cancelled = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // `fields` is read through a ref so a new list never remounts the editor.
  }, [dark, t.placeholder])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (value === cur) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {!cm && (
        <textarea
          data-testid="jql-input"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={t.placeholder}
          spellCheck={false}
          className="w-full resize-y overflow-auto bg-transparent px-3 py-2 font-mono text-xs leading-6 outline-none"
          style={{ height }}
        />
      )}
      <div
        ref={hostRef}
        data-testid={cm ? "jql-input" : undefined}
        className={cn("[&_.cm-editor]:h-full [&_.cm-editor]:outline-none", !cm && "hidden")}
        style={{ height: cm ? height : undefined, minHeight: cm ? height : 0 }}
      />
    </div>
  )
}
