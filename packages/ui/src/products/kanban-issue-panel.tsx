"use client"

import { Avatar, AvatarFallback } from "@monkey-mini-app/ui/components/avatar"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Separator } from "@monkey-mini-app/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@monkey-mini-app/ui/components/sheet"
import { CommentThread } from "@monkey-mini-app/ui/blocks/comment-thread"
import { DescriptionList } from "@monkey-mini-app/ui/blocks/description-list"
import { SeverityChip } from "@monkey-mini-app/ui/blocks/severity-chip"
import { StatusBadge } from "@monkey-mini-app/ui/blocks/status-badge"
import type { KanbanCard } from "@monkey-mini-app/ui/products/kanban"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function KanbanIssuePanel({
  card,
  columnTitle,
  open,
  onOpenChange,
}: {
  card: KanbanCard | null
  columnTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useLabels("kanbanIssue")
  if (!card) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg" data-testid="kanban-issue-panel">
        <SheetHeader>
          <SheetDescription className="font-mono text-xs">
            {card.key ?? card.id}
            {card.type ? ` · ${card.type}` : ""}
          </SheetDescription>
          <SheetTitle>{card.title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            {card.status ? <StatusBadge status={card.status} /> : null}
            {card.priority ? <SeverityChip severity={card.priority} /> : null}
            {columnTitle ? <Badge variant="outline">{columnTitle}</Badge> : null}
          </div>
          <DescriptionList
            items={[
              { label: t.assignee, value: card.assignee ?? t.unassigned },
              { label: t.reporter, value: card.reporter ?? "—" },
              { label: t.updated, value: card.updated ?? "—" },
            ]}
          />
          {card.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          <div>
            <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t.description}
            </div>
            <p className="text-sm leading-6 whitespace-pre-wrap">
              {card.description ?? t.noDescription}
            </p>
          </div>
          <Separator />
          <div>
            <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t.comments}
            </div>
            {card.comments?.length ? (
              <CommentThread comments={card.comments} />
            ) : (
              <p className="text-muted-foreground text-sm">{t.noComments}</p>
            )}
          </div>
          {card.assignee ? (
            <div className="mt-auto flex items-center gap-2 text-sm">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">
                  {card.assignee.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {card.assignee}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
