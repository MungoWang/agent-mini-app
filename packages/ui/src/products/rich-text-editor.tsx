"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Code, Italic, List, ListOrdered } from "lucide-react"

import { Toggle } from "@monkey-mini-app/ui/components/toggle"
import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder ?? t.placeholder })],
    content: value,
    onUpdate: ({ editor: instance }) => onChange?.(instance.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-32 px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1",
      },
    },
  })

  if (!editor) return <div data-testid="rich-text-editor" className="min-h-40 rounded-xl border" />

  return (
    <div data-testid="rich-text-editor" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap gap-0.5 border-b p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          aria-label={t.bold}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          aria-label={t.italic}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          aria-label={t.bullet}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          aria-label={t.ordered}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("code")}
          aria-label={t.code}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </Toggle>
      </div>
      <EditorContent editor={editor} className={cn("prose-sm max-w-none")} />
    </div>
  )
}
