"use client"

import * as React from "react"
import { Search } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@monkey-mini-app/ui/components/input-group"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  delay = 250,
  placeholder,
}: {
  value?: string
  onChange?: (value: string) => void
  onDebouncedChange?: (value: string) => void
  delay?: number
  placeholder?: string
}) {
  const t = useLabels("searchInput")
  const [inner, setInner] = React.useState(value ?? "")
  React.useEffect(() => setInner(value ?? ""), [value])
  React.useEffect(() => {
    const id = window.setTimeout(() => onDebouncedChange?.(inner), delay)
    return () => window.clearTimeout(id)
  }, [inner, delay, onDebouncedChange])

  return (
    <InputGroup className="max-w-sm" data-testid="search-input">
      <InputGroupAddon>
        <Search className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        value={inner}
        placeholder={placeholder ?? t.placeholder}
        onChange={(event) => {
          setInner(event.target.value)
          onChange?.(event.target.value)
        }}
      />
    </InputGroup>
  )
}
