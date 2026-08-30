import { ProgressRing } from "@monkey-mini-app/ui/blocks/progress-ring"

export function Gauge({ value, label, size = 48 }: { value: number; label?: string; size?: number }) {
  return (
    <div className="flex items-center gap-2" data-testid="gauge">
      <ProgressRing value={value} size={size} />
      <div>
        <div className="text-sm font-medium">{value}%</div>
        {label ? <div className="text-muted-foreground text-xs">{label}</div> : null}
      </div>
    </div>
  )
}
