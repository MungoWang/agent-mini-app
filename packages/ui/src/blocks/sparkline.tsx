"use client"

import { Line, LineChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@monkey-mini-app/ui/components/chart"

const config = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig

export function Sparkline({ data }: { data: { value: number }[] }) {
  return (
    <ChartContainer config={config} className="h-10 w-24" data-testid="sparkline">
      <LineChart data={data}>
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
