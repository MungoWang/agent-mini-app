"use client"

import type { ReactNode } from "react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"
import { StatCard } from "@monkey-mini-app/ui/blocks/stat-card"

export type TrendPoint = { label: string; value: number }

const chartConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig

export function TrendCard({
  title,
  value,
  delta,
  trend,
  data,
}: {
  title: string
  value: ReactNode
  delta?: string
  trend?: "up" | "down" | "flat"
  data: TrendPoint[]
}) {
  return (
    <StatCard title={title} value={value} delta={delta} trend={trend}>
      <ChartContainer config={chartConfig} className="h-[120px] w-full">
        <LineChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </StatCard>
  )
}
