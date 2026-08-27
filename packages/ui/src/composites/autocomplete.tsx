"use client"

import * as React from "react"

import { Input } from "@monkey-mini-app/ui/components/input"

export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
}: {
  value?: string
  onChange?: (value: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const filtered = options.filter((option) =>
    option.toLowerCase().includes((value ?? "").toLowerCase())
  )
  return (
    <div className="relative" data-testid="autocomplete">
      <Input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          onChange?.(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {filtered.slice(0, 20).map((option) => (
            <li key={option}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange?.(option)
                  setOpen(false)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
