import { Badge } from "@monkey-mini-app/ui/components/badge"
import { cn } from "@monkey-mini-app/ui/lib/utils"

const tone = {
  P0: "bg-destructive/15 text-destructive",
  P1: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  P2: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  P3: "bg-muted text-muted-foreground",
  critical: "bg-destructive/15 text-destructive",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
} as const

export type Severity = keyof typeof tone

export function SeverityChip({ severity }: { severity: Severity | string }) {
  return (
    <Badge
      variant="outline"
      data-testid="severity-chip"
      className={cn("border-transparent uppercase", tone[severity as Severity] ?? tone.low)}
    >
      {severity}
    </Badge>
  )
}
