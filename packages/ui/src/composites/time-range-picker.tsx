"use client"

import { TimePicker } from "@monkey-mini-app/ui/composites/time-picker"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type TimeRange = { start: string; end: string }

/**
 * From/to time of day.
 * @when Daily windows (maintenance 02:00–04:00).
 * @example
 * <TimeRangePicker onChange={(r) => set(r)} />
 * @family Calendar & date
 */
export function TimeRangePicker({
  value,
  onChange,
}: {
  value?: TimeRange
  onChange?: (value: TimeRange) => void
}) {
  const t = useLabels("timeRange")
  const start = value?.start ?? ""
  const end = value?.end ?? ""
  return (
    <div className="flex items-center gap-2" data-testid="time-range-picker">
      <TimePicker value={start} onChange={(next) => onChange?.({ start: next, end })} />
      <span className="text-muted-foreground text-xs">{t.to}</span>
      <TimePicker value={end} onChange={(next) => onChange?.({ start, end: next })} />
    </div>
  )
}
