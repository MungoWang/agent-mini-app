/**
 * @exampleOf DurationInput
 * @title DurationInput
 * @scenario Enter a length of time (hours + minutes), not a calendar date — timeouts, SLAs, shift lengths.
 * @hint Hours and minutes, not a text box
 */
import * as React from "react";

import { DurationInput } from "@monkey-mini-app/ui";

export default function DurationInput01Example() {
  const [duration, setDuration] = React.useState("2h 30m");

  return (
    <>
      <DurationInput value={duration} onChange={(v) => setDuration(v)} />
      <p className="text-muted-foreground mt-2 text-xs">{duration}</p>
    </>
  );
}
