"use client"

import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"

import { cn } from "@monkey-mini-app/ui/lib/utils"

export type Slice = { name: string; value: number; fill: string }

/**
 * Ring chart with centre label.
 * @when Part-of-whole (≤6 slices): storage usage, status split. More categories → `StackedBarChart`.
 * @example
 * <DonutChart data={[{ label: "OK", value: 82, color: "var(--primary)" }]} center="82%" />
 * @family Chart & data
 */
export function DonutChart({
  data,
  config,
  center,
  size,
  className,
}: {
  data: Slice[]
  config: ChartConfig
  center?: string
  size?: number
  className?: string
}) {
  return (
    <div className={cn("relative", className)} data-testid="donut-chart">
      <ChartContainer
        config={config}
        className={cn("mx-auto aspect-square", size ? "" : "w-full max-w-80")}
        style={size ? { width: size, height: size } : undefined}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} />
        </PieChart>
      </ChartContainer>
      {center ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium">
          {center}
        </div>
      ) : null}
    </div>
  )
}
