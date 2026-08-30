"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as ReRadar } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"

export function RadarChart({
  data,
  config,
  dataKey = "value",
}: {
  data: { label: string; value: number }[]
  config: ChartConfig
  dataKey?: string
}) {
  return (
    <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-80" data-testid="radar-chart">
      <ReRadar data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="label" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar dataKey={dataKey} fill="var(--color-value)" fillOpacity={0.35} />
      </ReRadar>
    </ChartContainer>
  )
}
