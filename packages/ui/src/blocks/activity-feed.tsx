import { Timeline, type TimelineItem } from "@monkey-mini-app/ui/products/timeline"

/**
 * Chronological activity list (avatar + text + time).
 * @when Read-only “who did what when” — commits, deploys, agent runs. For steps with status use `RunTimeline`.
 * @example
 * <ActivityFeed items={[{ id: "1", title: "部署完成", time: "10:24" }]} />
 * @family Realtime
 */
export function ActivityFeed({ items }: { items: TimelineItem[] }) {
  return (
    <div data-testid="activity-feed">
      <Timeline items={items} />
    </div>
  )
}
