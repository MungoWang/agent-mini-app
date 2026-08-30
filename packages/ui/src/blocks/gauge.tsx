import { ProgressRing } from "@monkey-mini-app/ui/blocks/progress-ring"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export function Gauge({
  value,
  label,
  size = 112,
  className,
}: {
  value: number
  label?: string
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      data-testid="gauge"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <ProgressRing value={value} className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{value}%</span>
        </div>
      </div>
      {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
    </div>
  )
}
