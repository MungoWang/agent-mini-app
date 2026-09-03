/**
 * @group charts-blocks
 * @title StatCard / TrendCard / Sparkline / Gauge / ProgressRing
 * @scenario KPI strip: StatCard for numbers with delta, TrendCard adding a sparkline, plus Sparkline/Gauge/ProgressRing for compact meters in one row.
 */
import { Gauge, ProgressRing, Sparkline, StatCard, TrendCard } from "@monkey-mini-app/ui";

const trend = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 9 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 16 },
];

export default function MiscChartsBlocks02Example() {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="Runs" value="128" delta="+12%" trend="up" />
        <TrendCard title="Throughput" value="22" delta="+4" trend="up" data={trend} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-32">
            <Sparkline data={trend} />
          </div>
          <Gauge value={72} label="Pass rate" size={64} />
          <ProgressRing value={72} />
        </div>
      </div>
    </>
  );
}
