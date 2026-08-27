import { Badge } from "@monkey-mini-app/ui/components/badge"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export const statusTone = {
  pass: "border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  fail: "border-transparent bg-destructive/15 text-destructive",
  blocked: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  flaky: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400",
  running: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400",
  pending: "border-transparent bg-muted text-muted-foreground",
} as const

export type StatusKey = keyof typeof statusTone

/**
 * Toned badge for run/test status.
 * @when pass | fail | blocked | flaky | running | pending cells and chips
 * @example
 * <StatusBadge status="pass" />
 */
export function StatusBadge({
  status,
  className,
}: {
  status: StatusKey | string
  className?: string
}) {
  const tone = statusTone[status as StatusKey] ?? statusTone.pending
  return (
    <Badge
      variant="outline"
      data-testid="status-badge"
      data-status={status}
      className={cn("capitalize", tone, className)}
    >
      {status}
    </Badge>
  )
}
