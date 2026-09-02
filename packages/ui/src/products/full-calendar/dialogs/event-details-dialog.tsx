"use client"

import { format, parseISO } from "date-fns"
import { Calendar, Clock, Text, User } from "lucide-react"
import { type ReactNode, useState } from "react"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@monkey-mini-app/ui/components/dialog"
import { ScrollArea } from "@monkey-mini-app/ui/components/scroll-area"

import { useCalendar } from "../contexts/calendar-context"
import { formatTime } from "../helpers"
import type { IEvent } from "../interfaces"
import { AddEditEventDialog } from "./add-edit-event-dialog"

export function EventDetailsDialog({ event, children }: { event: IEvent; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const startDate = parseISO(event.startDate)
  const endDate = parseISO(event.endDate)
  const { use24HourFormat, removeEvent } = useCalendar()

  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{event.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-2">
                <User className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Responsible</p>
                  <p className="text-sm text-muted-foreground">{event.user.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {format(startDate, "EEEE dd MMMM")}
                    <span className="mx-1">at</span>
                    {formatTime(parseISO(event.startDate), use24HourFormat)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">End Date</p>
                  <p className="text-sm text-muted-foreground">
                    {format(endDate, "EEEE dd MMMM")}
                    <span className="mx-1">at</span>
                    {formatTime(parseISO(event.endDate), use24HourFormat)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Text className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <AddEditEventDialog event={event}>
              <Button variant="outline">Edit</Button>
            </AddEditEventDialog>
            <Button
              variant="destructive"
              onClick={() => {
                removeEvent(event.id)
                setOpen(false)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
