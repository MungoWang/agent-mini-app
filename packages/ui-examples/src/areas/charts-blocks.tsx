import DashboardShell01Example from "../components/dashboard-shell/dashboard-shell-01";
import DetailPanel01Example from "../components/detail-panel/detail-panel-01";
import ListDetail01Example from "../components/list-detail/list-detail-01";
import MiscChartsBlocks01Example from "../components/misc-charts-blocks/misc-charts-blocks-01";
import MiscChartsBlocks02Example from "../components/misc-charts-blocks/misc-charts-blocks-02";
import MiscChartsBlocks03Example from "../components/misc-charts-blocks/misc-charts-blocks-03";
import MiscChartsBlocks04Example from "../components/misc-charts-blocks/misc-charts-blocks-04";
import MiscChartsBlocks05Example from "../components/misc-charts-blocks/misc-charts-blocks-05";
import MiscChartsBlocks06Example from "../components/misc-charts-blocks/misc-charts-blocks-06";
import RunTimeline01Example from "../components/run-timeline/run-timeline-01";
import Scrollspy01Example from "../components/scrollspy/scrollspy-01";
import TablePage01Example from "../components/table-page/table-page-01";
import { Example } from "../shared/example";

export function ChartBlockExamples() {
  return (
    <>
      <Example id="page-header-filter" title="PageHeader / FilterBar">
        <MiscChartsBlocks01Example />
      </Example>
      <Example id="stats" title="StatCard / TrendCard / Sparkline / Gauge / ProgressRing">
        <MiscChartsBlocks02Example />
      </Example>
      <Example id="charts" title="Donut / StackedBar / Radar">
        <MiscChartsBlocks03Example />
      </Example>
      <Example id="badges" title="StatusBadge / SeverityChip / EnvBadge">
        <MiscChartsBlocks04Example />
      </Example>
      <Example id="feeds" title="ActivityFeed / NotificationCenter / CommentThread / TestStepList">
        <MiscChartsBlocks05Example />
      </Example>
      <Example
        id="inspect"
        title="DescriptionList / RequestInspector / Terminal / FileTree / AttachmentGallery"
      >
        <MiscChartsBlocks06Example />
      </Example>
      <Example
        id="dashboard-shell"
        title="DashboardShell"
        hint="Scroll the chart column — the header and KPI strip stay; narrow the panel and the rail folds underneath"
      >
        <DashboardShell01Example />
      </Example>
      <Example id="detail-panel" title="DetailPanel">
        <DetailPanel01Example />
      </Example>
      <Example
        id="list-detail"
        title="ListDetail"
        hint="Scroll either pane — the toolbar and the other pane stay put"
      >
        <ListDetail01Example />
      </Example>
      <Example
        id="table-page"
        title="TablePage"
        hint="Scroll the table — the toolbar stays put; select rows — the bar floats over, it never pushes rows down"
      >
        <TablePage01Example />
      </Example>
      <Example id="run-timeline" title="RunTimeline">
        <RunTimeline01Example />
      </Example>
      <Example id="scrollspy" title="Scrollspy">
        <Scrollspy01Example />
      </Example>
    </>
  );
}
