import { cn } from "@monkey-mini-app/ui/lib/utils"

export type TimelineItem = {
  id: string
  title: string
  description?: string
  time?: string
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-4" data-testid="timeline">
      {items.map((item, index) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute top-1.5 -left-[21px] size-2.5 rounded-full border bg-background",
              index === 0 ? "border-primary bg-primary" : "border-muted-foreground/40"
            )}
          />
          <div className="text-sm font-medium">{item.title}</div>
          {item.description ? (
            <p className="text-muted-foreground text-xs">{item.description}</p>
          ) : null}
          {item.time ? (
            <p className="text-muted-foreground mt-0.5 text-[11px]">{item.time}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
