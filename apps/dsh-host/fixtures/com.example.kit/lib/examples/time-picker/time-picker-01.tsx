/**
 * @exampleOf TimePicker
 * @title TimePicker
 * @scenario Time-of-day only (no date) for windows like a daily cron or shift start.
 */
import * as React from "react";

import { TimePicker } from "@monkey-mini-app/ui";

export default function TimePicker01Example() {
  const [time, setTime] = React.useState("09:30");

  return (
    <>
      <TimePicker value={time} onChange={setTime} />
      <p className="text-muted-foreground mt-2 text-xs">{time || "empty"}</p>
    </>
  );
}
