"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { Calendar } from "@monkey-mini-app/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import { DateChrome } from "@monkey-mini-app/ui/composites/date-chrome"
import { TimeWheel } from "@monkey-mini-app/ui/composites/time-picker"
import { TimezoneSelect } from "@monkey-mini-app/ui/composites/timezone-select"
import { useDateLocale, useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

function merge(date: Date | undefined, hours: number, minutes: number): Date {
  const next = new Date(date ?? new Date())
  next.setHours(hours, minutes, 0, 0)
  return next
}

export type DateTimePickerProps = {
  value?: Date
  onChange?: (date: Date | undefined) => void
  timezone?: string
  onTimezoneChange?: (zone: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  timezone,
  onTimezoneChange,
  placeholder,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(value ?? new Date())
  const hours = value?.getHours() ?? 0
  const minutes = value?.getMinutes() ?? 0
  const t = useLabels("dateTimePicker")
  const dateLocale = useDateLocale()
  const text = placeholder ?? t.placeholder
  React.useEffect(() => {
    if (value) setMonth(value)
  }, [value])

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="date-time-picker">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              data-empty={!value}
              data-testid="date-picker-trigger"
              className={cn(
                "w-[280px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarIcon />
          {value ? format(value, "PPP p", { locale: dateLocale }) : <span>{text}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0">
          <div className="flex">
            <DateChrome
              month={month}
              onMonthChange={setMonth}
              onToday={() => onChange?.(merge(new Date(), hours, minutes))}
            >
              <Calendar
                mode="single"
                locale={dateLocale}
                month={month}
                onMonthChange={setMonth}
                selected={value}
                hideNavigation
                classNames={{ month_caption: "hidden", nav: "hidden" }}
                onSelect={(date) => onChange?.(merge(date, hours, minutes))}
              />
            </DateChrome>
            <div className="flex gap-1 border-l px-2 py-2">
              <TimeWheel
                testId="time-hour"
                visible={7}
                values={Array.from({ length: 24 }, (_, i) => i)}
                value={hours}
                onChange={(h) => onChange?.(merge(value, h, minutes))}
              />
              <TimeWheel
                testId="time-minute"
                visible={7}
                values={Array.from({ length: 60 }, (_, i) => i)}
                value={minutes}
                onChange={(m) => onChange?.(merge(value, hours, m))}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {onTimezoneChange ? (
        <TimezoneSelect value={timezone} onChange={onTimezoneChange} />
      ) : null}
    </div>
  )
}
