"use client"

import * as React from "react"
import { format, isSameMonth, isSameYear, type Locale } from "date-fns"
import type { DateRange } from "react-day-picker"
import { ChevronDown } from "lucide-react"

import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useDateLocale, useLabels } from "@monkey-mini-app/ui/i18n/context"
import { Button } from "@monkey-mini-app/ui/components/button"
import { Calendar } from "@monkey-mini-app/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import { DateChrome } from "@monkey-mini-app/ui/composites/date-chrome"

export type DateRangePickerProps = {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

function rangeLabel(value: DateRange, locale: Locale) {
  const opts = { locale }
  if (!value.from) return null
  if (!value.to) return format(value.from, "yyyy, MMMM d", opts)
  if (isSameYear(value.from, value.to) && isSameMonth(value.from, value.to)) {
    return `${format(value.from, "yyyy, MMMM d", opts)}–${format(value.to, "d", opts)}`
  }
  if (isSameYear(value.from, value.to)) {
    return `${format(value.from, "yyyy, MMM d", opts)} – ${format(value.to, "MMM d", opts)}`
  }
  return `${format(value.from, "MMM d, yyyy", opts)} – ${format(value.to, "MMM d, yyyy", opts)}`
}

/**
 * Popover date range with month/year chrome.
 * @when Filters needing from/to calendar days
 * @example
 * <DateRangePicker value={range} onChange={setRange} />
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
}: DateRangePickerProps) {
  const t = useLabels("dateRangePicker")
  const dateLocale = useDateLocale()
  const text = placeholder ?? t.placeholder
  const [month, setMonth] = React.useState(value?.from ?? new Date())
  const label = value?.from ? rangeLabel(value, dateLocale) : text

  React.useEffect(() => {
    if (value?.from) setMonth(value.from)
  }, [value?.from])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            data-testid="date-range-picker-trigger"
            className={cn(
              "justify-between font-medium",
              !value?.from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <DateChrome month={month} onMonthChange={setMonth}>
          <Calendar
            mode="range"
            locale={dateLocale}
            month={month}
            onMonthChange={setMonth}
            selected={value}
            onSelect={onChange}
            hideNavigation
            numberOfMonths={1}
            classNames={{ month_caption: "hidden", nav: "hidden" }}
          />
        </DateChrome>
      </PopoverContent>
    </Popover>
  )
}
