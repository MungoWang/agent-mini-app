/**
 * @group charts-blocks
 * @title StatusBadge / SeverityChip / EnvBadge
 * @scenario Status vocabulary in one view: StatusBadge (pass/fail/flaky, lowercase statuses), SeverityChip (P0–P3) and EnvBadge (dev/stg/prd) so triage rows read consistently.
 */
import { EnvBadge, SeverityChip, StatusBadge } from "@monkey-mini-app/ui";

export default function MiscChartsBlocks04Example() {
  return (
    <>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="pass" />
          <StatusBadge status="fail" />
          <StatusBadge status="flaky" />
          <SeverityChip severity="P0" />
          <EnvBadge env="stg" />
        </div>
    </>
  );
}
