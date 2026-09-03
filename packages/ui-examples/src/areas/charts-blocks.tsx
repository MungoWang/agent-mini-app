import * as React from "react";

import { ActivityFeed, AttachmentGallery, Button, CommentThread, DescriptionList, DetailPanel, DonutChart, EnvBadge, FileTree, FilterBar, Gauge, Input, NotificationCenter, PageHeader, ProgressRing, RadarChart, RequestInspector, RunTimeline, Scrollspy, SeverityChip, Sparkline, StackedBarChart, StatCard, StatusBadge, Terminal, TestStepList, TrendCard } from "@monkey-mini-app/ui";

import { Example } from "../shared/example";

const trend = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 9 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 16 },
];

export function ChartBlockExamples() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Example id="page-header-filter" title="PageHeader / FilterBar">
        <PageHeader title="QA Runs" description="Latest CI" actions={<Button size="sm">New</Button>} />
        <FilterBar>
          <Input placeholder="Filter…" className="max-w-xs" />
          <Button variant="outline" size="sm">Apply</Button>
        </FilterBar>
      </Example>
      <Example id="stats" title="StatCard / TrendCard / Sparkline / Gauge / ProgressRing">
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard title="Runs" value="128" delta="+12%" trend="up" />
          <TrendCard title="Throughput" value="22" delta="+4" trend="up" data={trend} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-32"><Sparkline data={trend} /></div>
            <Gauge value={72} label="Pass rate" size={64} />
            <ProgressRing value={72} />
          </div>
        </div>
      </Example>
      <Example id="charts" title="Donut / StackedBar / Radar">
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
      </Example>
      <Example id="badges" title="StatusBadge / SeverityChip / EnvBadge">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="pass" />
          <StatusBadge status="fail" />
          <StatusBadge status="flaky" />
          <SeverityChip severity="P0" />
          <EnvBadge env="stg" />
        </div>
      </Example>
      <Example id="feeds" title="ActivityFeed / NotificationCenter / CommentThread / TestStepList">
        <div className="grid gap-4 md:grid-cols-2">
          <ActivityFeed items={[{ id: "1", title: "Deployed", time: "10:00" }]} />
          <NotificationCenter items={[{ id: "1", title: "Build failed", body: "login-spec" }]} />
          <CommentThread comments={[{ id: "1", author: "Ada", body: "Looks good", time: "now" }]} />
          <TestStepList
            steps={[
              { id: "1", title: "Login", status: "pass" },
              { id: "2", title: "Checkout", status: "fail" },
            ]}
          />
        </div>
      </Example>
      <Example id="inspect" title="DescriptionList / RequestInspector / Terminal / FileTree / AttachmentGallery">
        <div className="flex flex-col gap-3">
          <DescriptionList items={[{ label: "Owner", value: "Ada" }, { label: "Env", value: "stg" }]} />
          <RequestInspector method="GET" url="/runs" response='{"ok":true}' />
          <Terminal lines={["$ pnpm test", "ok"]} />
          <FileTree nodes={[{ id: "src", label: "src", children: [{ id: "a", label: "a.ts" }] }]} />
          <AttachmentGallery files={[{ name: "shot.png" }]} />
        </div>
      </Example>
      <Example id="detail-panel" title="DetailPanel">
        <Button onClick={() => setOpen(true)}>Open inspector</Button>
        <DetailPanel open={open} onOpenChange={setOpen} title="login-spec" description="Last run">
          Failed at step 2
        </DetailPanel>
      </Example>
      <Example id="run-timeline" title="RunTimeline">
        <RunTimeline items={[{ id: "1", title: "Queued" }, { id: "2", title: "Running" }]} />
      </Example>
      <Example id="scrollspy" title="Scrollspy">
        <div className="grid grid-cols-[8rem_1fr] gap-4">
          <Scrollspy sections={[{ id: "alpha", label: "Alpha" }, { id: "beta", label: "Beta" }]} />
          <div className="h-32 overflow-auto text-sm">
            <div id="alpha" className="h-24">Alpha section</div>
            <div id="beta" className="h-24">Beta section</div>
          </div>
        </div>
      </Example>
    </>
  );
}
