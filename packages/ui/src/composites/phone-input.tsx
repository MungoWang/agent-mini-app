"use client"

import { Input } from "@monkey-mini-app/ui/components/input"

export function PhoneInput({
  value,
  onChange,
}: {
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <Input
      data-testid="phone-input"
      type="tel"
      inputMode="tel"
      placeholder="+86 138 0000 0000"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    />
  )
}
