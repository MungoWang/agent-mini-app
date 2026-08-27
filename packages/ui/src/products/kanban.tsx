"use client"

import * as React from "react"
import type { ReactNode } from "react"
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Avatar, AvatarFallback } from "@monkey-mini-app/ui/components/avatar"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export type KanbanComment = {
  id: string
  author: string
  body: string
  time?: string
}

export type KanbanCard = {
  id: string
  title: string
  columnId: string
  key?: string
  type?: string
  status?: string
  description?: string
  assignee?: string
  reporter?: string
  tags?: string[]
  priority?: "P0" | "P1" | "P2" | "P3" | string
  updated?: string
  comments?: KanbanComment[]
}

export type KanbanColumn = {
  id: string
  title: string
  limit?: number
}

const priorityTone: Record<string, string> = {
  P0: "bg-destructive/15 text-destructive",
  P1: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  P2: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  P3: "bg-muted text-muted-foreground",
}

function DefaultCard({ card }: { card: KanbanCard }) {
  return (
    <>
      {card.key ? (
        <div className="text-muted-foreground mb-1 font-mono text-[10px]">{card.key}</div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{card.title}</div>
        {card.priority ? (
          <Badge
            variant="outline"
            className={cn(
              "border-transparent text-[10px]",
              priorityTone[card.priority] ?? "bg-muted"
            )}
          >
            {card.priority}
          </Badge>
        ) : null}
      </div>
      {card.description ? (
        <p className="text-muted-foreground line-clamp-2 text-xs">{card.description}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {card.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
        {card.assignee ? (
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">
              {card.assignee.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </>
  )
}

function Card({
  card,
  children,
  onCardClick,
}: {
  card: KanbanCard
  children: ReactNode
  onCardClick?: (card: KanbanCard) => void
}) {
  const origin = React.useRef({ x: 0, y: 0 })
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  })
  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-card-${card.id}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-pointer rounded-lg border bg-card px-2.5 py-2 text-left shadow-xs",
        isDragging && "opacity-70"
      )}
      {...attributes}
      {...listeners}
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, y: event.clientY }
        listeners?.onPointerDown?.(event)
      }}
      onClick={(event) => {
        if (
          Math.hypot(
            event.clientX - origin.current.x,
            event.clientY - origin.current.y
          ) > 6
        ) {
          return
        }
        onCardClick?.(card)
      }}
    >
      {children}
    </div>
  )
}

function Column({
  column,
  cards,
  renderCard,
  onCardClick,
}: {
  column: KanbanColumn
  cards: KanbanCard[]
  renderCard?: (card: KanbanCard) => ReactNode
  onCardClick?: (card: KanbanCard) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const overLimit = column.limit != null && cards.length > column.limit
  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2",
        isOver && "border-primary/50"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {column.title}
        </div>
        <span
          className={cn(
            "text-[11px] tabular-nums text-muted-foreground",
            overLimit && "text-destructive"
          )}
        >
          {cards.length}
          {column.limit != null ? ` / ${column.limit}` : ""}
        </span>
      </div>
      <div ref={setNodeRef} className="flex min-h-32 flex-col gap-2">
        {cards.map((card) => (
          <Card key={card.id} card={card} onCardClick={onCardClick}>
            {renderCard ? renderCard(card) : <DefaultCard card={card} />}
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * DnD board: columns + cards. Move cards across columns via drag.
 * @when Issue/workflow boards
 * @example
 * <Kanban columns={cols} cards={cards} onCardsChange={setCards} onCardClick={open} />
 */
export function Kanban({
  columns,
  cards,
  onCardsChange,
  renderCard,
  onCardClick,
}: {
  columns: KanbanColumn[]
  cards: KanbanCard[]
  onCardsChange?: (cards: KanbanCard[]) => void
  renderCard?: (card: KanbanCard) => ReactNode
  onCardClick?: (card: KanbanCard) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const overId = String(over.id)
    const overColumn = columns.some((column) => column.id === overId)
      ? overId
      : cards.find((card) => card.id === overId)?.columnId
    if (!overColumn) return
    onCardsChange?.(
      cards.map((card) =>
        card.id === String(active.id) ? { ...card, columnId: overColumn } : card
      )
    )
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="kanban">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={cards.filter((card) => card.columnId === column.id)}
            renderCard={renderCard}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
