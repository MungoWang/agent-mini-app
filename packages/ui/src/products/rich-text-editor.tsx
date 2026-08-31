"use client"

import { useEffect, useState } from "react"

import { Bold, Code, Italic, List, ListOrdered } from "lucide-react"

import { Toggle } from "@monkey-mini-app/ui/components/toggle"
import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

/**
 * Rich-text editor. tiptap is heavy + rarely used, so it's loaded from a CDN on
 * demand. We render a native <textarea> first (immediately editable), then swap
 * to the real editor once tiptap has loaded. If the CDN is unavailable we stay
 * on the textarea (editing raw HTML/text still works fine).
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
  const [tiptap, setTiptap] = useState<{ react: { useEditor: (o: any) => any; EditorContent: (p: any) => any }; starterKit: any; placeholder: any } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [react, starterKit, placeholder] = await Promise.all([
          import("https://esm.run/@tiptap/react@3.30.3"),
          import("https://esm.run/@tiptap/starter-kit@3.30.3"),
          import("https://esm.run/@tiptap/extension-placeholder@3.30.3"),
        ])
        if (cancelled) return
        setTiptap({ react, starterKit, placeholder })
      } catch {
        // CDN unavailable → stay on the native <textarea>.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ph = placeholder ?? t.placeholder

  if (!tiptap) {
    return (
      <textarea
        data-testid="rich-text-editor"
        value={value}
        placeholder={ph}
        onChange={(e) => onChange?.(e.target.value)}
        className="min-h-40 w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none"
      />
    )
  }

  return <TiptapEditor tiptap={tiptap} value={value} onChange={onChange} placeholder={ph} labels={t} />
}

function TiptapEditor({
  tiptap,
  value,
  onChange,
  placeholder,
  labels,
}: {
  tiptap: { react: { useEditor: (o: any) => any; EditorContent: (p: any) => any }; starterKit: any; placeholder: any }
  value: string
  onChange?: (html: string) => void
  placeholder: string
  labels: Record<string, string>
}) {
  const { useEditor, EditorContent } = tiptap.react
  // Hooks live here (this component only mounts once tiptap has loaded).
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [tiptap.starterKit.default, tiptap.placeholder.default.configure({ placeholder })],
    content: value,
    onUpdate: ({ editor }: any) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: "min-h-32 px-3 py-2 text-sm outline-none" },
    },
  })
  if (!editor) return <div data-testid="rich-text-editor" className="min-h-40 rounded-xl border" />
  const run = (fn: any) => () => fn(editor.chain().focus())
  return (
    <div data-testid="rich-text-editor" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap gap-0.5 border-b p-1">
        <Toggle size="sm" aria-label={labels.bold} onPressedChange={run((c: any) => c.toggleBold().run())}>
          <Bold className="size-3.5" />
        </Toggle>
        <Toggle size="sm" aria-label={labels.italic} onPressedChange={run((c: any) => c.toggleItalic().run())}>
          <Italic className="size-3.5" />
        </Toggle>
        <Toggle size="sm" aria-label={labels.code} onPressedChange={run((c: any) => c.toggleCode().run())}>
          <Code className="size-3.5" />
        </Toggle>
        <Toggle size="sm" aria-label={labels.bulletList} onPressedChange={run((c: any) => c.toggleBulletList().run())}>
          <List className="size-3.5" />
        </Toggle>
        <Toggle size="sm" aria-label={labels.orderedList} onPressedChange={run((c: any) => c.toggleOrderedList().run())}>
          <ListOrdered className="size-3.5" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
