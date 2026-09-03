/**
 * @exampleOf DatePicker
 * @title DatePicker
 * @scenario Pick a single calendar date; popover trigger shows the formatted value and supports clearing.
 */
import * as React from "react";

import { DatePicker } from "@monkey-mini-app/ui";

export default function DatePicker01Example() {
  const [date, setDate] = React.useState<Date | undefined>(new Date("2026-08-26"));

  return <DatePicker value={date} onChange={setDate} />;
}
