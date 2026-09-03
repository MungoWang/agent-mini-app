/**
 * @exampleOf RunTimeline
 * @title RunTimeline
 * @scenario Ordered steps of one job (queued → running → done) with per-step status; denser than a Table when the story is sequence.
 */
import { RunTimeline } from "@monkey-mini-app/ui";

export default function RunTimeline01Example() {
  return (
    <RunTimeline items={[{ id: "1", title: "Queued" }, { id: "2", title: "Running" }]} />
  );
}
