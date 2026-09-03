/**
 * @exampleOf DateTimePicker
 * @title DateTimePicker
 * @scenario Date + time + timezone edited as a single value in one popover, for scheduling where the zone matters (CI triggers, shifts).
 * @hint One popover: calendar + time
 */
import * as React from "react";

import { DateTimePicker } from "@monkey-mini-app/ui";

export default function DateTimePicker01Example() {
  const [dt, setDt] = React.useState<Date | undefined>(new Date("2026-08-26T09:15:00"));
  const [zone, setZone] = React.useState("Asia/Shanghai");

  return <DateTimePicker value={dt} onChange={setDt} timezone={zone} onTimezoneChange={setZone} />;
}
