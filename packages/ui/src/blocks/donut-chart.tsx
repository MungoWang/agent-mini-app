"use client"

import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"

export type Slice = { name: string; value: number; fill: string }

export function DonutChart({
  data,
  config,
  center,
}: {
  data: Slice[]
  config: ChartConfig
  center?: string
}) {
  return (
    <div className="relative" data-testid="donut-chart">
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-80">
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
