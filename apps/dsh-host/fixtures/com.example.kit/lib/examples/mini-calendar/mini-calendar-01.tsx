/**
 * @exampleOf MiniCalendar
 * @title MiniCalendar
 * @scenario An always-visible inline calendar (no popover) — side rail of a scheduler, or date filtered next to a list.
 */
import * as React from "react";

import { MiniCalendar } from "@monkey-mini-app/ui";

export default function MiniCalendar01Example() {
  const [mini, setMini] = React.useState<Date | undefined>(new Date());

  return <MiniCalendar value={mini} onChange={setMini} />;
}
