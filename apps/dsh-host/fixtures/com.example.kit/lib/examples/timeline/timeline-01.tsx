/**
 * @exampleOf Timeline
 * @title Timeline
 * @scenario Chronological feed of events with actor + timestamp — deploy history, audit trail (compare RunTimeline for one job's steps).
 */
import { Timeline } from "@monkey-mini-app/ui";

export default function Timeline01Example() {
  return (
    <Timeline
      items={[
        { id: "1", title: "Opened", time: "10:00" },
        { id: "2", title: "Running", time: "10:02" },
        { id: "3", title: "Passed", time: "10:04" },
      ]}
    />
  );
}
