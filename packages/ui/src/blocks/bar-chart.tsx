"use client"

import { Bar, BarChart as ReBar, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"

export function StackedBarChart({
  data,
  config,
  keys,
}: {
  data: Record<string, string | number>[]
  config: ChartConfig
  keys: string[]
}) {
  return (
    <ChartContainer config={config} className="aspect-video w-full" data-testid="bar-chart">
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
