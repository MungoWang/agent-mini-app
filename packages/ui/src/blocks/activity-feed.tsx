import { Timeline, type TimelineItem } from "@monkey-mini-app/ui/products/timeline"

export function ActivityFeed({ items }: { items: TimelineItem[] }) {
  return (
    <div data-testid="activity-feed">
      <Timeline items={items} />
    </div>
  )
}
