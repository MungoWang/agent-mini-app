"use client"

import { Bar, BarChart as ReBar, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"
import { cn } from "@monkey-mini-app/ui/lib/utils"

/**
 * Stacked bar chart over flat rows.
 * @family Chart & data
 * @when Comparing several series across categories (pass/fail per day). Single ratio → `DonutChart`; trend → `Sparkline`.
 * @example
 * <StackedBarChart
 *   data={[{ label: "09-01", ok: 12, fail: 2 }]}
 *   keys={["ok", "fail"]}
 *   config={{ ok: { label: "通过", color: "var(--primary)" }, fail: { label: "失败", color: "var(--destructive)" } }}
 * />
 */
export function StackedBarChart({
  data,
  config,
  keys,
  className,
}: {
  data: Record<string, string | number>[]
  config: ChartConfig
  keys: string[]
  className?: string
}) {
  return (
    <ChartContainer config={config} className={cn("aspect-video w-full", className)} data-testid="bar-chart">
      <ReBar accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((key) => (
          <Bar key={key} dataKey={key} stackId="a" fill={`var(--color-${key})`} />
        ))}
      </ReBar>
    </ChartContainer>
  )
}
