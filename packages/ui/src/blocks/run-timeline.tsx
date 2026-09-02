import { Timeline, type TimelineItem } from "@monkey-mini-app/ui/products/timeline"

/**
 * Timeline of run phases with duration + status.
 * @when CI/agent/job phases on a time axis. Plain ordered events → `Timeline`.
 * @example
 * <RunTimeline items={[{ id: "p1", title: "checkout", status: "pass", time: "3s" }]} />
 * @family Realtime
 */
export function RunTimeline({ items }: { items: TimelineItem[] }) {
  return <Timeline items={items} />
}
