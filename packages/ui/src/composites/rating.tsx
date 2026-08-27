"use client"

import { Star } from "lucide-react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

export function Rating({
  value = 0,
  onChange,
  max = 5,
}: {
  value?: number
  onChange?: (value: number) => void
  max?: number
}) {
  return (
    <div className="flex items-center gap-0.5" data-testid="rating">
      {Array.from({ length: max }, (_, index) => {
        const score = index + 1
        return (
          <button
            key={score}
            type="button"
            aria-label={`${score} star`}
            onClick={() => onChange?.(score)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Star
              className={cn(
                "size-4",
                score <= value && "fill-amber-400 text-amber-400"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
