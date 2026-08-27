"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import { cn } from "@monkey-mini-app/ui/lib/utils"

const ITEM_H = 36

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value)
  if (!match) return { hours: 0, minutes: 0 }
  return {
    hours: Math.min(23, Number(match[1])),
    minutes: Math.min(59, Number(match[2])),
  }
}

export function TimeWheel({
  values,
  value,
  onChange,
  testId,
  visible = 5,
  className,
}: {
  values: number[]
  value: number
  onChange: (value: number) => void
  testId: string
  visible?: number
  className?: string
}) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const padPx = ITEM_H * Math.floor((visible - 1) / 2)
  const index = Math.max(0, values.indexOf(value))
  const armed = React.useRef(false)
  const timer = React.useRef<number>(0)

  const jump = React.useCallback((i: number) => {
    const list = listRef.current
    if (!list || list.clientHeight === 0) return
    list.scrollTop = i * ITEM_H
  }, [])

  React.useLayoutEffect(() => {
    armed.current = false
    const list = listRef.current
    if (!list) return
    jump(index)
    const ro = new ResizeObserver(() => jump(index))
    ro.observe(list)
    const t1 = window.setTimeout(() => jump(index), 0)
    const t2 = window.setTimeout(() => jump(index), 32)
    return () => {
      ro.disconnect()
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [index, jump])

  const commit = () => {
    const list = listRef.current
    if (!list || !armed.current) return
    const next = Math.min(
      values.length - 1,
      Math.max(0, Math.round(list.scrollTop / ITEM_H))
    )
    jump(next)
    const picked = values[next]
    if (picked != null && picked !== value) onChange(picked)
  }

  return (
    <div
      className={cn("relative w-14", className)}
      style={{ height: ITEM_H * visible }}
    >
      <div className="bg-muted pointer-events-none absolute inset-x-0 top-1/2 z-0 h-9 -translate-y-1/2 rounded-md" />
      <div
        ref={listRef}
        data-testid={testId}
        className="relative z-10 h-full overflow-y-auto [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          maskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
        }}
        onPointerDown={() => {
          armed.current = true
        }}
        onScroll={() => {
          if (!armed.current) return
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(commit, 80)
        }}
      >
        <div style={{ height: padPx }} />
        {values.map((item, i) => (
          <button
            key={item}
            type="button"
            data-selected={item === value || undefined}
            className={cn(
              "flex w-full items-center justify-center text-sm tabular-nums",
              item === value
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
            style={{ height: ITEM_H }}
            onClick={() => {
              jump(i)
              onChange(item)
            }}
          >
            {pad(item)}
          </button>
        ))}
        <div style={{ height: padPx }} />
      </div>
    </div>
  )
}

export type TimePickerProps = {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}

/** `value` is `HH:mm` (24h). */
export function TimePicker({
  value = "",
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const parsed = parseTime(value)
  const [hours, setHours] = React.useState(parsed.hours)
  const [minutes, setMinutes] = React.useState(parsed.minutes)
  React.useEffect(() => {
    const next = parseTime(value)
    setHours(next.hours)
    setMinutes(next.minutes)
  }, [value])
  const emit = (nextHours: number, nextMinutes: number) => {
    setHours(nextHours)
    setMinutes(nextMinutes)
    onChange?.(`${pad(nextHours)}:${pad(nextMinutes)}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="outline"
            data-testid="time-picker"
            className={cn("w-[120px] justify-between font-normal tabular-nums", className)}
          />
        }
      >
        <span>{value || "--:--"}</span>
        <ChevronDown className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex items-center gap-1">
          <TimeWheel
            testId="time-picker-hour"
            values={Array.from({ length: 24 }, (_, i) => i)}
            value={hours}
            onChange={(h) => emit(h, minutes)}
          />
          <span className="text-muted-foreground pb-0.5 text-sm font-medium">:</span>
          <TimeWheel
            testId="time-picker-minute"
            values={Array.from({ length: 60 }, (_, i) => i)}
            value={minutes}
            onChange={(m) => emit(hours, m)}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
