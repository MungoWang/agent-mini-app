import { ProgressRing } from "@monkey-mini-app/ui/blocks/progress-ring"

export function Gauge({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="gauge">
      <ProgressRing value={value} />
      <div>
        <div className="text-sm font-medium">{value}%</div>
        {label ? <div className="text-muted-foreground text-xs">{label}</div> : null}
      </div>
    </div>
  )
}
