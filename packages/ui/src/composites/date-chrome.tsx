"use client"

import * as React from "react"
import { addMonths, addYears, format, setMonth, setYear } from "date-fns"
import { ArrowDown, ArrowUp } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { useDateLocale, useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

function Stepper({
  onUp,
  onDown,
}: {
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="flex items-center">
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Previous" onClick={onUp}>
        <ArrowUp className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Next" onClick={onDown}>
        <ArrowDown className="size-3.5" />
      </Button>
    </div>
  )
}

function decadeOf(year: number) {
  return Math.floor(year / 12) * 12
}

export function DateChrome({
  month,
  onMonthChange,
  onToday,
  children,
}: {
  month: Date
  onMonthChange: (month: Date) => void
  onToday?: () => void
  children: React.ReactNode
}) {
  const dateLocale = useDateLocale()
  const common = useLabels("common")
  const year = month.getFullYear()
  const [yearPane, setYearPane] = React.useState(false)
  const [decadeStart, setDecadeStart] = React.useState(() => decadeOf(year))

  React.useEffect(() => {
    if (year < decadeStart || year >= decadeStart + 12) {
      setDecadeStart(decadeOf(year))
    }
  }, [year, decadeStart])

  return (
    <div className="flex" data-testid="date-chrome">
      <div className="flex min-w-[252px] flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{format(month, "yyyy MMMM", { locale: dateLocale })}</div>
          <Stepper
            onUp={() => onMonthChange(addMonths(month, -1))}
            onDown={() => onMonthChange(addMonths(month, 1))}
          />
        </div>
        {children}
      </div>
      <div className="bg-border w-px" />
      <div className="flex w-[220px] flex-col p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            data-testid="date-chrome-year"
            className="hover:bg-muted rounded-md px-1.5 py-0.5 text-sm font-semibold"
            onClick={() => setYearPane((open) => !open)}
          >
            {yearPane ? `${decadeStart}–${decadeStart + 11}` : year}
          </button>
          <Stepper
            onUp={() => {
              if (yearPane) setDecadeStart((start) => start - 12)
              else onMonthChange(addYears(month, -1))
            }}
            onDown={() => {
              if (yearPane) setDecadeStart((start) => start + 12)
              else onMonthChange(addYears(month, 1))
            }}
          />
        </div>
        {yearPane ? (
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {Array.from({ length: 12 }, (_, index) => {
              const item = decadeStart + index
              const active = item === year
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`date-chrome-year-${item}`}
                  className={cn(
                    "rounded-md py-1.5 text-sm",
                    active
                      ? "bg-primary/15 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => {
                    onMonthChange(setYear(month, item))
                    setYearPane(false)
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {Array.from({ length: 12 }, (_, index) => {
              const active = month.getMonth() === index
              return (
                <button
                  key={index}
                  type="button"
                  data-testid={`date-chrome-month-${index}`}
                  className={cn(
                    "rounded-md py-1.5 text-sm",
                    active
                      ? "bg-primary/15 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => onMonthChange(setMonth(month, index))}
                >
                  {format(new Date(year, index, 1), "LLL", { locale: dateLocale })}
                </button>
              )
            })}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-auto self-end"
          data-testid="date-chrome-today"
          onClick={() => {
            setYearPane(false)
            onMonthChange(new Date())
            onToday?.()
          }}
        >
          {common.today}
        </Button>
      </div>
    </div>
  )
}
