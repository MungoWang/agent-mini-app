/**
 * @exampleOf RelativeDatePicker
 * @title RelativeDatePicker
 * @scenario Preset ranges ('last 7 days', 'this month') that resolve to absolute timestamps on submit — the usual filter on dashboards and log screens.
 */
import * as React from "react";

import { type DateRange, RelativeDatePicker, type RelativePreset } from "@monkey-mini-app/ui";

export default function RelativeDatePicker01Example() {
  const [preset, setPreset] = React.useState<RelativePreset>("7d");
  const [rel, setRel] = React.useState<DateRange | undefined>();

  return (
    <>
      <RelativeDatePicker preset={preset} value={rel} onPresetChange={setPreset} onChange={setRel} />
    </>
  );
}
