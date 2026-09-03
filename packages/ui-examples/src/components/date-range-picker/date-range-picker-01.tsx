/**
 * @exampleOf DateRangePicker
 * @title DateRangePicker
 * @scenario Pick from/to as one value — one popover, both endpoints validated together, so you never re-check 'to > from' yourself.
 */
import * as React from "react";

import { type DateRange, DateRangePicker } from "@monkey-mini-app/ui";

export default function DateRangePicker01Example() {
  const [range, setRange] = React.useState<DateRange | undefined>();

  return <DateRangePicker value={range} onChange={setRange} />;
}
