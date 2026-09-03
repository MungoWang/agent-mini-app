/**
 * @exampleOf Timeline
 * @title Timeline
 * @scenario Chronological feed of events with actor + timestamp — deploy history, audit trail (compare RunTimeline for one job's steps).
 */
import * as React from "react";

import { type SortableItem, Timeline } from "@monkey-mini-app/ui";

export default function Timeline01Example() {
  const [items, setItems] = React.useState<SortableItem[]>([
    { id: "1", label: "Alpha" },
    { id: "2", label: "Bravo" },
    { id: "3", label: "Charlie" },
  ]);

  return (
    <>
      <Timeline
        items={[
          { id: "1", title: "Opened", time: "10:00" },
          { id: "2", title: "Running", time: "10:02" },
          { id: "3", title: "Passed", time: "10:04" },
        ]}
      />
    </>
  );
}
