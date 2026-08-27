"use client"

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

export type SortableItem = { id: string; label: string }

function Row({ item }: { item: SortableItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-sm"
    >
      <button type="button" className="text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-3.5" />
      </button>
      {item.label}
    </div>
  )
}

export function SortableList({
  items,
  onChange,
}: {
  items: SortableItem[]
  onChange?: (items: SortableItem[]) => void
}) {
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    onChange?.(arrayMove(items, oldIndex, newIndex))
  }
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5" data-testid="sortable-list">
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
