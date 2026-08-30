"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as ReRadar } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@monkey-mini-app/ui/components/chart"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export function RadarChart({
  data,
  config,
  dataKey = "value",
  size,
  className,
}: {
  data: { label: string; value: number }[]
  config: ChartConfig
  dataKey?: string
  size?: number
  className?: string
}) {
  return (
    <ChartContainer
      config={config}
      className={cn("mx-auto aspect-square", size ? "" : "w-full max-w-80", className)}
      style={size ? { width: size, height: size } : undefined}
      data-testid="radar-chart"
    >
      <ReRadar data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="label" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar dataKey={dataKey} fill="var(--color-value)" fillOpacity={0.35} />
      </ReRadar>
    </ChartContainer>
  )
}
