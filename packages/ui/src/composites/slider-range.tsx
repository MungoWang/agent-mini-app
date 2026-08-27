"use client"

import { Slider } from "@monkey-mini-app/ui/components/slider"

export function SliderRange({
  value = [20, 80],
  onChange,
  min = 0,
  max = 100,
}: {
  value?: number[]
  onChange?: (value: number[]) => void
  min?: number
  max?: number
}) {
  return (
    <div className="w-56" data-testid="slider-range">
      <Slider
        value={value}
        min={min}
        max={max}
        onValueChange={(next) => onChange?.(Array.from(next as number[]))}
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{value[0]}</span>
        <span>{value[1]}</span>
      </div>
    </div>
  )
}
