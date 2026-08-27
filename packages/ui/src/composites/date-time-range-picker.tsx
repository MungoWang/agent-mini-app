"use client"

import { Label } from "@monkey-mini-app/ui/components/label"
import { DateRangePicker } from "@monkey-mini-app/ui/composites/date-range-picker"
import { DateTimePicker } from "@monkey-mini-app/ui/composites/date-time-picker"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type DateTimeRange = { start?: Date; end?: Date }

export function DateTimeRangePicker({
  value,
  onChange,
  allDay = false,
}: {
  value?: DateTimeRange
  onChange?: (value: DateTimeRange) => void
  allDay?: boolean
}) {
  const t = useLabels("dateTimeRange")
  if (allDay) {
    return (
      <div data-testid="date-time-range-picker">
        <DateRangePicker
          value={{ from: value?.start, to: value?.end }}
          onChange={(range) => onChange?.({ start: range?.from, end: range?.to })}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="date-time-range-picker">
      <div className="grid gap-1">
        <Label>{t.start}</Label>
        <DateTimePicker
          value={value?.start}
          onChange={(start) => onChange?.({ start, end: value?.end })}
          className="w-full"
        />
      </div>
      <div className="grid gap-1">
        <Label>{t.end}</Label>
        <DateTimePicker
          value={value?.end}
          onChange={(end) => onChange?.({ start: value?.start, end })}
          className="w-full"
        />
      </div>
    </div>
  )
}
