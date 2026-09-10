/**
 * @exampleOf DashboardShell
 * @title DashboardShell
 * @scenario Ops overview in a fixed-height panel: the header and KPI strip stay pinned while the charts scroll, and the activity rail scrolls on its own beside them.
 * @hint Scroll the chart column — the numbers stay; narrow the panel and the rail folds underneath
 */
import {
  ActivityFeed,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DashboardShell,
  PageHeader,
  Sparkline,
  StatCard,
} from "@monkey-mini-app/ui";

const series = (seed: number, n = 24) =>
  Array.from({ length: n }, (_, i) => ({
    value: 40 + Math.round(28 * Math.abs(Math.sin((i + seed) / 3))),
  }));

const FEED = Array.from({ length: 14 }, (_, i) => ({
  id: `e${i}`,
  title: [
    "node-3 restarted by scheduler",
    "p95 back under 120 ms",
    "queue depth 1.2k → 300",
    "nightly export finished",
    "certificate renews in 6 days",
  ][i % 5],
  time: `${String(23 - (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
}));

export default function DashboardShell01Example() {
  return (
    <div className="h-[460px]">
      <DashboardShell
        header={<PageHeader title="值班总览" description="每 5 秒刷新 · 头部与指标不会跟着内容滑走" />}
        kpis={
          <div className="grid grid-cols-4 gap-3 px-4 pb-3">
            <StatCard title="Requests" value="18.4k" delta="+6%" trend="up" />
            <StatCard title="p95" value="112 ms" delta="-9 ms" trend="down" />
            <StatCard title="Errors" value="3" trend="flat" />
            <StatCard title="Queue" value="290" delta="-910" trend="down" />
          </div>
        }
        main={
          <div className="flex flex-col gap-3 p-4">
            {[
              ["Throughput", 1],
              ["Latency p95", 5],
              ["Saturated workers", 9],
              ["Retries", 13],
              ["Queue depth", 17],
            ].map(([title, seed]) => (
              <Card key={String(title)}>
                <CardHeader>
                  <CardTitle className="text-sm font-normal">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Sparkline data={series(Number(seed))} />
                </CardContent>
              </Card>
            ))}
          </div>
        }
        aside={
          <div className="flex flex-col gap-2 p-4">
            <p className="text-muted-foreground text-xs tracking-widest uppercase">Activity</p>
            <ActivityFeed items={FEED} />
          </div>
        }
      />
    </div>
  );
}
