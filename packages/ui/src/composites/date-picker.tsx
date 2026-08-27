"use client"

import * as React from "react"
import { format } from "date-fns"
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

export type DatePickerProps = {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(value ?? new Date())
  const t = useLabels("datePicker")
  const dateLocale = useDateLocale()
  const text = placeholder ?? t.placeholder

  React.useEffect(() => {
    if (value) setMonth(value)
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="secondary"
            data-empty={!value}
            data-testid="date-picker-trigger"
            className={cn(
              "justify-between font-medium data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        <span className="truncate">
          {value ? format(value, "yyyy, MMMM d", { locale: dateLocale }) : text}
        </span>
        <ChevronDown className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <DateChrome
          month={month}
          onMonthChange={setMonth}
          onToday={() => {
            const now = new Date()
            onChange?.(now)
            setOpen(false)
          }}
        >
          <Calendar
            mode="single"
            locale={dateLocale}
            month={month}
            onMonthChange={setMonth}
            selected={value}
            hideNavigation
            classNames={{ month_caption: "hidden", nav: "hidden" }}
            onSelect={(date) => {
              onChange?.(date)
              setOpen(false)
            }}
          />
        </DateChrome>
      </PopoverContent>
    </Popover>
  )
}
