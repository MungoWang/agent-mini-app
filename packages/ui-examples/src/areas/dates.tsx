import DatePicker01Example from "../components/date-picker/date-picker-01";
import DateRangePicker01Example from "../components/date-range-picker/date-range-picker-01";
import DateTimePicker01Example from "../components/date-time-picker/date-time-picker-01";
import DateTimeRangePicker01Example from "../components/date-time-range-picker/date-time-range-picker-01";
import DurationInput01Example from "../components/duration-input/duration-input-01";
import MiniCalendar01Example from "../components/mini-calendar/mini-calendar-01";
import RelativeDatePicker01Example from "../components/relative-date-picker/relative-date-picker-01";
import TimePicker01Example from "../components/time-picker/time-picker-01";
import TimeRangePicker01Example from "../components/time-range-picker/time-range-picker-01";
import TimezoneSelect01Example from "../components/timezone-select/timezone-select-01";
import { Example } from "../shared/example";

export function DateExamples() {
  return (
    <>
      <Example id="date-picker" title="DatePicker">
        <DatePicker01Example />
      </Example>
      <Example id="date-range-picker" title="DateRangePicker">
        <DateRangePicker01Example />
      </Example>
      <Example id="time-picker" title="TimePicker">
        <TimePicker01Example />
      </Example>
      <Example id="time-range-picker" title="TimeRangePicker">
        <TimeRangePicker01Example />
      </Example>
      <Example id="date-time-picker" title="DateTimePicker" hint="One popover: calendar + time">
        <DateTimePicker01Example />
      </Example>
      <Example
        id="date-time-range-picker"
        title="DateTimeRangePicker"
        hint="Two DateTimePickers; allDay switches to a date range"
      >
        <DateTimeRangePicker01Example />
      </Example>
      <Example id="timezone-select" title="TimezoneSelect" hint="Common zones first; type to search the rest">
        <TimezoneSelect01Example />
      </Example>
      <Example id="mini-calendar" title="MiniCalendar">
        <MiniCalendar01Example />
      </Example>
      <Example id="relative-date-picker" title="RelativeDatePicker">
        <RelativeDatePicker01Example />
      </Example>
      <Example id="duration-input" title="DurationInput" hint="Hours and minutes, not a text box">
        <DurationInput01Example />
      </Example>
    </>
  );
}
