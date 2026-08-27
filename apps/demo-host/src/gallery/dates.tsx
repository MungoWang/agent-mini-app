import * as React from "react"
import type { DateRange } from "react-day-picker"
import { DatePicker } from "@monkey-mini-app/ui/composites/date-picker"
import { DateRangePicker } from "@monkey-mini-app/ui/composites/date-range-picker"
import { DateTimePicker } from "@monkey-mini-app/ui/composites/date-time-picker"
import { DateTimeRangePicker } from "@monkey-mini-app/ui/composites/date-time-range-picker"
import { DurationInput } from "@monkey-mini-app/ui/composites/duration-input"
import { MiniCalendar } from "@monkey-mini-app/ui/composites/mini-calendar"
import { RelativeDatePicker, type RelativePreset } from "@monkey-mini-app/ui/composites/relative-date-picker"
import { TimePicker } from "@monkey-mini-app/ui/composites/time-picker"
import { TimeRangePicker } from "@monkey-mini-app/ui/composites/time-range-picker"
import { TimezoneSelect } from "@monkey-mini-app/ui/composites/timezone-select"
import { Example } from "./section"

export function DateExamples() {
  const [date, setDate] = React.useState<Date | undefined>(new Date("2026-08-26"))
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [time, setTime] = React.useState("09:30")
  const [timeRange, setTimeRange] = React.useState({ start: "09:00", end: "18:00" })
  const [dt, setDt] = React.useState<Date | undefined>(new Date("2026-08-26T09:15:00"))
  const [dtRange, setDtRange] = React.useState<{ start?: Date; end?: Date }>({})
  const [zone, setZone] = React.useState("Asia/Shanghai")
  const [mini, setMini] = React.useState<Date | undefined>(new Date())
  const [preset, setPreset] = React.useState<RelativePreset>("7d")
  const [rel, setRel] = React.useState<DateRange | undefined>()
  const [duration, setDuration] = React.useState("2h 30m")

  return (
    <>
      <Example id="date-picker" title="DatePicker">
        <DatePicker value={date} onChange={setDate} />
      </Example>
      <Example id="date-range-picker" title="DateRangePicker">
        <DateRangePicker value={range} onChange={setRange} />
      </Example>
      <Example id="time-picker" title="TimePicker">
        <TimePicker value={time} onChange={setTime} />
        <p className="text-muted-foreground mt-2 text-xs">{time || "empty"}</p>
      </Example>
      <Example id="time-range-picker" title="TimeRangePicker">
        <TimeRangePicker value={timeRange} onChange={setTimeRange} />
      </Example>
      <Example id="date-time-picker" title="DateTimePicker" hint="One popover: calendar + time">
        <DateTimePicker value={dt} onChange={setDt} timezone={zone} onTimezoneChange={setZone} />
      </Example>
      <Example id="date-time-range-picker" title="DateTimeRangePicker" hint="Two DateTimePickers; allDay switches to a date range">
        <DateTimeRangePicker value={dtRange} onChange={setDtRange} />
      </Example>
      <Example id="timezone-select" title="TimezoneSelect" hint="Common zones first; type to search the rest">
        <TimezoneSelect value={zone} onChange={setZone} />
      </Example>
      <Example id="mini-calendar" title="MiniCalendar">
        <MiniCalendar value={mini} onChange={setMini} />
      </Example>
      <Example id="relative-date-picker" title="RelativeDatePicker">
        <RelativeDatePicker
          preset={preset}
          value={rel}
          onPresetChange={setPreset}
          onChange={setRel}
        />
      </Example>
      <Example id="duration-input" title="DurationInput" hint="Hours and minutes, not a text box">
        <DurationInput value={duration} onChange={(v) => setDuration(v)} />
        <p className="text-muted-foreground mt-2 text-xs">{duration}</p>
      </Example>
    </>
  )
}
