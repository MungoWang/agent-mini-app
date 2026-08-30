"use client"

import { Line, LineChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@monkey-mini-app/ui/components/chart"
import { cn } from "@monkey-mini-app/ui/lib/utils"

const config = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig

export function Sparkline({ data, className }: { data: { value: number }[]; className?: string }) {
  return (
    <ChartContainer config={config} className={cn("h-20 w-full", className)} data-testid="sparkline">
      <LineChart data={data}>
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
