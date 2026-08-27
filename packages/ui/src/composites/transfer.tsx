"use client"

import { Button } from "@monkey-mini-app/ui/components/button"

export type TransferItem = { id: string; label: string }

export function Transfer({
  items,
  value = [],
  onChange,
}: {
  items: TransferItem[]
  value?: string[]
  onChange?: (value: string[]) => void
}) {
  const selected = new Set(value)
  const left = items.filter((item) => !selected.has(item.id))
  const right = items.filter((item) => selected.has(item.id))
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" data-testid="transfer">
      <ul className="h-40 overflow-auto rounded-lg border p-1 text-sm">
        {left.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1 text-left hover:bg-muted"
              onClick={() => onChange?.([...value, item.id])}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="icon-xs" disabled>
        →
      </Button>
      <ul className="h-40 overflow-auto rounded-lg border p-1 text-sm">
        {right.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1 text-left hover:bg-muted"
              onClick={() => onChange?.(value.filter((id) => id !== item.id))}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
