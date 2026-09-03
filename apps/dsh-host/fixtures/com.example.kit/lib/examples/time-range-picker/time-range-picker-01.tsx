/**
 * @exampleOf TimeRangePicker
 * @title TimeRangePicker
 * @scenario Start/end time-of-day pair, e.g. a maintenance window inside one day.
 */
import * as React from "react";

import { type DateRange, type RelativePreset, TimeRangePicker } from "@monkey-mini-app/ui";

const [date, setDate] = React.useState<Date | undefined>(new Date("2026-08-26"));

const [range, setRange] = React.useState<DateRange | undefined>();

const [time, setTime] = React.useState("09:30");

const [timeRange, setTimeRange] = React.useState({ start: "09:00", end: "18:00" });

const [dt, setDt] = React.useState<Date | undefined>(new Date("2026-08-26T09:15:00"));

const [dtRange, setDtRange] = React.useState<{ start?: Date; end?: Date }>({});

const [zone, setZone] = React.useState("Asia/Shanghai");

const [mini, setMini] = React.useState<Date | undefined>(new Date());

const [preset, setPreset] = React.useState<RelativePreset>("7d");

const [rel, setRel] = React.useState<DateRange | undefined>();

const [duration, setDuration] = React.useState("2h 30m");

export default function TimeRangePicker01Example() {
  return <TimeRangePicker value={timeRange} onChange={setTimeRange} />;
}
