import { Item, ItemContent, ItemDescription, ItemTitle } from "@monkey-mini-app/ui/components/item"

export type NotificationItem = {
  id: string
  title: string
  body?: string
}

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  return (
    <div className="flex flex-col gap-1" data-testid="notification-center">
      {items.map((item) => (
        <Item key={item.id} variant="outline">
          <ItemContent>
            <ItemTitle>{item.title}</ItemTitle>
            {item.body ? <ItemDescription>{item.body}</ItemDescription> : null}
          </ItemContent>
        </Item>
      ))}
    </div>
  )
}
