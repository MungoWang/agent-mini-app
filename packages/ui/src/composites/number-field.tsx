"use client"

import { Button } from "@monkey-mini-app/ui/components/button"
import { Input } from "@monkey-mini-app/ui/components/input"
import { Minus, Plus } from "lucide-react"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function NumberField({
  value = 0,
  onChange,
  min,
  max,
  step = 1,
}: {
  value?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const clamp = (next: number) => {
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    return next
  }
  const t = useLabels("numberField")
  return (
    <div className="flex items-center gap-1" data-testid="number-field">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={t.decrease}
        onClick={() => onChange?.(clamp(value - step))}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange?.(clamp(Number(event.target.value)))}
        className="w-20 text-center"
      />
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={t.increase}
        onClick={() => onChange?.(clamp(value + step))}
      >
        <Plus />
      </Button>
    </div>
  )
}
