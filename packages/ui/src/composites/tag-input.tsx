"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Input } from "@monkey-mini-app/ui/components/input"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function TagInput({
  value = [],
  onChange,
  placeholder,
}: {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
}) {
  const t = useLabels("tagInput")
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const next = draft.trim()
    if (!next || value.includes(next)) return
    onChange?.([...value, next])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2" data-testid="tag-input">
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange?.(value.filter((item) => item !== tag))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={draft}
        placeholder={placeholder ?? t.placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            add()
          }
        }}
      />
    </div>
  )
}
