"use client"

import { Check } from "lucide-react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

export type Step = { id: string; title: string; description?: string }

export function Stepper({
  steps,
  current,
  orientation = "vertical",
  onStepClick,
}: {
  steps: Step[]
  current: number
  orientation?: "vertical" | "horizontal"
  onStepClick?: (index: number) => void
}) {
  const horizontal = orientation === "horizontal"

  return (
    <ol
      data-testid="stepper"
      data-orientation={orientation}
      className={cn(horizontal ? "flex items-start gap-0" : "flex flex-col gap-3")}
    >
      {steps.map((step, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "todo"
        const clickable = Boolean(onStepClick)
        return (
          <li
            key={step.id}
            className={cn(
              horizontal
                ? "flex min-w-0 flex-1 flex-col items-center text-center"
                : "flex gap-3"
            )}
          >
            <div
              className={cn(
                "flex items-center",
                horizontal ? "w-full justify-center" : "flex-col"
              )}
            >
              {horizontal && index > 0 ? (
                <span
                  className={cn(
                    "mr-2 h-px min-w-4 flex-1",
                    index <= current ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(index)}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "current" && "border-2 border-primary text-primary",
                  state === "todo" && "border text-muted-foreground",
                  clickable && "cursor-pointer"
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : index + 1}
              </button>
              {horizontal && index < steps.length - 1 ? (
                <span
                  className={cn(
                    "ml-2 h-px min-w-4 flex-1",
                    index < current ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
            </div>
            <div className={cn(horizontal ? "mt-2 px-1" : "")}>
              <div className="text-sm font-medium">{step.title}</div>
              {step.description ? (
                <p className="text-muted-foreground text-xs">{step.description}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
