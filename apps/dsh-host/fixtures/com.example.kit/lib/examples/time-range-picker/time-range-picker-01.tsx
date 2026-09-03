/**
 * @exampleOf TimeRangePicker
 * @title TimeRangePicker
 * @scenario Start/end time-of-day pair, e.g. a maintenance window inside one day.
 */
import * as React from "react";

import { TimeRangePicker } from "@monkey-mini-app/ui";

export default function TimeRangePicker01Example() {
  const [timeRange, setTimeRange] = React.useState({ start: "09:00", end: "18:00" });

  return <TimeRangePicker value={timeRange} onChange={setTimeRange} />;
}
