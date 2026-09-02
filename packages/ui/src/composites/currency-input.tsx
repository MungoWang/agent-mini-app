"use client"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@monkey-mini-app/ui/components/input-group"

/**
 * Amount input with grouping + currency prefix.
 * @when Money fields; keeps the raw string out of your state.
 * @example
 * <CurrencyInput currency="CNY" onChange={(v) => set(v)} />
 * @family Form
 */
export function CurrencyInput({
  value,
  onChange,
  currency = "¥",
}: {
  value?: string
  onChange?: (value: string) => void
  currency?: string
}) {
  return (
    <InputGroup className="w-40" data-testid="currency-input">
      <InputGroupAddon>
        <InputGroupText>{currency}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value.replace(/[^\d.]/g, ""))}
      />
    </InputGroup>
  )
}
