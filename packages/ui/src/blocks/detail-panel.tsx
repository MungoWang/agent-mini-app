"use client"

import type { ReactNode } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@monkey-mini-app/ui/components/sheet"

/**
 * Right-side inspector Sheet for a selected row/entity.
 * @when Master-detail after row/card click
 * @example
 * <DetailPanel open={!!id} onOpenChange={() => setId(null)} title="Run #12">{body}</DetailPanel>
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="detail-panel">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
