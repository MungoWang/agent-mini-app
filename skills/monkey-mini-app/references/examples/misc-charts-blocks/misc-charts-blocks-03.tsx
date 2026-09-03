/**
 * @group charts-blocks
 * @title Donut / StackedBar / Radar
 * @scenario Recharts-backed set: DonutChart for share-of-total, StackedBarChart for composition over time, RadarChart for multi-axis scorecards — all fed plain arrays.
 */
import { DonutChart, RadarChart, StackedBarChart } from "@monkey-mini-app/ui";

const trend = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 9 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 16 },
];

export default function MiscChartsBlocks03Example() {
  return (
    <>
        <div className="grid gap-4 md:grid-cols-3">
          <DonutChart
            center="128"
            config={{ pass: { label: "Pass", color: "var(--chart-1)" }, fail: { label: "Fail", color: "var(--chart-2)" } }}
            data={[
              { name: "pass", value: 90, fill: "var(--color-pass)" },
              { name: "fail", value: 38, fill: "var(--color-fail)" },
            ]}
          />
          <StackedBarChart
            keys={["pass", "fail"]}
            config={{ pass: { label: "Pass", color: "var(--chart-1)" }, fail: { label: "Fail", color: "var(--chart-2)" } }}
            data={[{ label: "Mon", pass: 12, fail: 2 }, { label: "Tue", pass: 18, fail: 1 }]}
          />
          <RadarChart
            config={{ value: { label: "Score", color: "var(--chart-1)" } }}
            data={[
              { label: "A", value: 80 },
              { label: "B", value: 60 },
              { label: "C", value: 90 },
            ]}
          />
        </div>
    </>
  );
}
