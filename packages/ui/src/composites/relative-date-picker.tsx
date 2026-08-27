"use client"

import { subDays } from "date-fns"
import type { DateRange } from "react-day-picker"

import { Button } from "@monkey-mini-app/ui/components/button"
import { DateRangePicker } from "@monkey-mini-app/ui/composites/date-range-picker"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type RelativePreset = "today" | "7d" | "30d" | "sprint" | "custom"

function rangeFor(id: RelativePreset): DateRange | undefined {
  const now = new Date()
  if (id === "today") return { from: now, to: now }
  if (id === "7d") return { from: subDays(now, 6), to: now }
  if (id === "30d") return { from: subDays(now, 29), to: now }
  if (id === "sprint") return { from: subDays(now, 13), to: now }
  return undefined
}

export function RelativeDatePicker({
  preset = "7d",
  value,
  onPresetChange,
  onChange,
}: {
  preset?: RelativePreset
  value?: DateRange
  onPresetChange?: (preset: RelativePreset) => void
  onChange?: (range: DateRange | undefined) => void
}) {
  const t = useLabels("relativeDate")
  const presets: { id: RelativePreset; label: string }[] = [
    { id: "today", label: t.today },
    { id: "7d", label: t.last7d },
    { id: "30d", label: t.last30d },
    { id: "sprint", label: t.sprint },
    { id: "custom", label: t.custom },
  ]
  return (
    <div className="flex flex-col gap-2" data-testid="relative-date-picker">
      <div className="flex flex-wrap gap-1">
        {presets.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={preset === item.id ? "default" : "outline"}
            onClick={() => {
              onPresetChange?.(item.id)
              if (item.id !== "custom") onChange?.(rangeFor(item.id))
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {preset === "custom" ? (
        <DateRangePicker value={value} onChange={onChange} />
      ) : null}
    </div>
  )
}
