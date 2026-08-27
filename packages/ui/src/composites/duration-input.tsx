"use client"

import { Minus, Plus } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { Input } from "@monkey-mini-app/ui/components/input"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function parseDuration(input: string): number {
  const hours = Number(/(\d+)\s*h/i.exec(input)?.[1] ?? 0)
  const minutes = Number(/(\d+)\s*m/i.exec(input)?.[1] ?? 0)
  if (!/[hm]/i.test(input) && /^\d+$/.test(input.trim())) {
    return Number(input)
  }
  return hours * 60 + minutes
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(Math.max(0, totalMinutes) / 60)
  const rest = Math.max(0, totalMinutes) % 60
  if (hours && rest) return `${hours}h ${rest}m`
  if (hours) return `${hours}h`
  return `${rest}m`
}

function split(value?: string) {
  const total = parseDuration(value ?? "0m")
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

function Segment({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const t = useLabels("durationInput")
  const clamp = (next: number) => {
    if (max != null) next = Math.min(max, next)
    return Math.max(min, next)
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t.decrease(label)}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus />
      </Button>
      <Input
        inputMode="numeric"
        value={String(value)}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, "") || 0)
          onChange(clamp(next))
        }}
        className="h-7 w-10 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
      />
      <span className="text-muted-foreground w-4 text-xs">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t.increase(label)}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus />
      </Button>
    </div>
  )
}

export function DurationInput({
  value,
  onChange,
}: {
  value?: string
  onChange?: (value: string, minutes: number) => void
}) {
  const t = useLabels("durationInput")
  const { hours, minutes } = split(value)
  const commit = (h: number, m: number) => {
    let total = h * 60 + m
    if (total < 0) total = 0
    onChange?.(formatDuration(total), total)
  }

  return (
    <div
      data-testid="duration-input"
      className="inline-flex items-center gap-1 rounded-lg border bg-background px-1 py-0.5"
    >
      <Segment
        label={t.hours}
        value={hours}
        onChange={(h) => commit(h, minutes)}
      />
      <span className="text-muted-foreground/40">·</span>
      <Segment
        label={t.minutes}
        value={minutes}
        min={-1}
        onChange={(m) => {
          if (m >= 60) commit(hours + 1, 0)
          else if (m < 0) commit(hours <= 0 ? 0 : hours - 1, hours <= 0 ? 0 : 59)
          else commit(hours, m)
        }}
      />
    </div>
  )
}
