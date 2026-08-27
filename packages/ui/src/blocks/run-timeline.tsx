import { Timeline, type TimelineItem } from "@monkey-mini-app/ui/products/timeline"

export function RunTimeline({ items }: { items: TimelineItem[] }) {
  return <Timeline items={items} />
}
