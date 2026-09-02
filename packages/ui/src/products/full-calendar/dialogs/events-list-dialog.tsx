"use client"

import { format } from "date-fns"
import { type ReactNode, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@monkey-mini-app/ui/components/dialog"
import { cn } from "@monkey-mini-app/ui/lib/utils"

import { useCalendar } from "../contexts/calendar-context"
import { formatTime } from "../helpers"
import type { IEvent } from "../interfaces"
import { dayCellVariants } from "../views/month-view/day-cell"
import { EventBullet } from "../views/month-view/event-bullet"
import { EventDetailsDialog } from "./event-details-dialog"

export function EventListDialog({
  date,
  events,
  maxVisibleEvents = 3,
  children,
}: {
  date: Date
  events: IEvent[]
  maxVisibleEvents?: number
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const hiddenEventsCount = Math.max(events.length - maxVisibleEvents, 0)
  const { badgeVariant, use24HourFormat } = useCalendar()
  const defaultTrigger = (
    <span className="cursor-pointer" data-testid="calendar-more">
      <span className="sm:hidden">+{hiddenEventsCount}</span>
      <span className="hidden rounded-xl border px-2 py-0.5 sm:inline">+{hiddenEventsCount} more</span>
    </span>
  )

  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {children || defaultTrigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                {events[0] ? <EventBullet color={events[0].color} /> : null}
                <p className="text-sm font-medium">Events on {format(date, "EEEE, MMMM d, yyyy")}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {events.length > 0 ? (
              events.map((event) => (
                <EventDetailsDialog event={event} key={event.id}>
                  <div
                    className={cn("flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted", {
                      [dayCellVariants({ color: event.color })]: badgeVariant === "colored",
                    })}
                  >
                    <EventBullet color={event.color} />
                    <div className="flex w-full items-center justify-between">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs">{formatTime(event.startDate, use24HourFormat)}</p>
                    </div>
                  </div>
                </EventDetailsDialog>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No events for this date.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
