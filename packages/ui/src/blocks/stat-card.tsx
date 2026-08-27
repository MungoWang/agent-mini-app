import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@monkey-mini-app/ui/components/card"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export type StatCardProps = {
  title: string
  value: ReactNode
  delta?: string
  trend?: "up" | "down" | "flat"
  children?: ReactNode
}

/**
 * KPI card: title, value, optional delta/trend.
 * @when Dashboard metric strip
 * @example
 * <StatCard title="Pass rate" value="98%" delta="+1.2%" trend="up" />
 */
export function StatCard({ title, value, delta, trend = "flat", children }: StatCardProps) {
  return (
    <Card data-testid="stat-card">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="text-2xl font-medium" data-testid="stat-card-value">
          {value}
        </div>
        {delta ? (
          <div
            data-testid="stat-card-delta"
            className={cn(
              "text-xs",
              trend === "up" && "text-emerald-600",
              trend === "down" && "text-destructive",
              trend === "flat" && "text-muted-foreground"
            )}
          >
            {delta}
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  )
}
