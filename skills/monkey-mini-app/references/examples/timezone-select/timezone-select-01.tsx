/**
 * @exampleOf TimezoneSelect
 * @title TimezoneSelect
 * @scenario IANA timezone chosen from common zones first, searchable — pair with DateTimePicker when schedules cross regions.
 * @hint Common zones first; type to search the rest
 */
import * as React from "react";

import { TimezoneSelect } from "@monkey-mini-app/ui";

export default function TimezoneSelect01Example() {
  const [zone, setZone] = React.useState("Asia/Shanghai");

  return <TimezoneSelect value={zone} onChange={setZone} />;
}
