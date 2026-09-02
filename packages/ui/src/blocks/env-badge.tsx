import { Badge } from "@monkey-mini-app/ui/components/badge"
import { cn } from "@monkey-mini-app/ui/lib/utils"

const tone: Record<string, string> = {
  prd: "bg-destructive/15 text-destructive",
  prod: "bg-destructive/15 text-destructive",
  stg: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  staging: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  dev: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  local: "bg-muted text-muted-foreground",
}

/**
 * Coloured pill for an environment name.
 * @when prd / stg / dev markers in headers and tables.
 * @example
 * <EnvBadge env="production" />
 * @family Feedback & status
 */
export function EnvBadge({ env }: { env: string }) {
  return (
    <Badge
      variant="outline"
      data-testid="env-badge"
      className={cn("border-transparent uppercase", tone[env.toLowerCase()] ?? tone.local)}
    >
      {env}
    </Badge>
  )
}
