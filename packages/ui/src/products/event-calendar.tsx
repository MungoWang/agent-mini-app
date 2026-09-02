"use client"

import { cn } from "@monkey-mini-app/ui/lib/utils"

import { CalendarBody } from "./full-calendar/calendar-body"
import { CalendarProvider } from "./full-calendar/contexts/calendar-context"
import { DndProvider } from "./full-calendar/contexts/dnd-context"
import { CalendarHeader } from "./full-calendar/header/calendar-header"
import type { IEvent, IUser } from "./full-calendar/interfaces"
import type { TCalendarView, TEventColor } from "./full-calendar/types"

export type CalendarView = TCalendarView
export type CalendarEvent = IEvent
export type CalendarUser = IUser
export type CalendarEventColor = TEventColor

/**
 * Full calendar (day / week / month / year / agenda). Event shape matches
 * yassir-jeraidi/full-calendar: { id, title, startDate, endDate, color, description, user }.
 * @when Scheduling, on-call, release windows
 * @example
 * <EventCalendar events={events} onEventsChange={setEvents} view="week" />
 * @family Calendar & date
 */
export function EventCalendar({
  events,
  users = [],
  view = "month",
  date,
  onEventsChange,
  className,
}: {
  events: IEvent[]
  users?: IUser[]
  view?: TCalendarView
  date?: Date
  onEventsChange?: (events: IEvent[]) => void
  className?: string
}) {
  return (
    <div data-testid="event-calendar" className={cn("w-full overflow-hidden rounded-xl border bg-card", className)}>
      <CalendarProvider events={events} users={users} view={view} date={date} onEventsChange={onEventsChange}>
        <DndProvider>
          <CalendarHeader />
          <CalendarBody />
        </DndProvider>
      </CalendarProvider>
    </div>
  )
}
