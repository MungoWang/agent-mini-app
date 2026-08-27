"use client"

import * as React from "react"
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@monkey-mini-app/ui/components/dialog"
import { Input } from "@monkey-mini-app/ui/components/input"
import { Label } from "@monkey-mini-app/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import { Switch } from "@monkey-mini-app/ui/components/switch"
import { DateTimeRangePicker } from "@monkey-mini-app/ui/composites/date-time-range-picker"
import { useDateLocale, useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

export type CalendarView = "month" | "week" | "day"

export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
}

type Draft = {
  start: Date
  end: Date
  allDay: boolean
  event?: CalendarEvent
}

const HOUR_HEIGHT = 48
const SNAP = 15
const MONTH_MAX = 3
const WEEK_STARTS_ON = 1 as const

function applyTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number)
  return setMinutes(setHours(startOfDay(date), h || 0), m || 0)
}

function snapMinutes(value: number) {
  const max = 24 * 60
  const next = Math.round(value / SNAP) * SNAP
  return Math.min(max, Math.max(0, next))
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function atMinutes(day: Date, minutes: number) {
  return addMinutes(startOfDay(day), Math.min(24 * 60, Math.max(0, minutes)))
}

function isBarEvent(event: CalendarEvent) {
  if (event.allDay) return true
  return differenceInCalendarDays(event.end, event.start) >= 1
}

function exclusiveAllDayEnd(inclusive: Date) {
  return addDays(startOfDay(inclusive), 1)
}

function inclusiveAllDayEnd(exclusive: Date) {
  const start = startOfDay(exclusive)
  return addDays(start, start.getTime() === exclusive.getTime() ? -1 : 0)
}

function eventTouchesDay(event: CalendarEvent, day: Date) {
  const start = startOfDay(event.start)
  const end = event.allDay ? event.end : startOfDay(addMinutes(event.end, -1))
  const t = startOfDay(day)
  return t >= start && t < (event.allDay ? event.end : addDays(end, 1))
}

function timedOnDay(event: CalendarEvent, day: Date) {
  if (isBarEvent(event)) return false
  return isSameDay(event.start, day)
}

type Packed = CalendarEvent & { startMin: number; endMin: number; col: number; cols: number }

function packDay(events: CalendarEvent[], day: Date): Packed[] {
  const origin = startOfDay(day)
  const items: Packed[] = events
    .filter((event) => timedOnDay(event, day))
    .map((event) => {
      const startMin = Math.max(0, differenceInMinutes(event.start, origin))
      const endMin = Math.min(24 * 60, Math.max(startMin + SNAP, differenceInMinutes(event.end, origin)))
      return { ...event, startMin, endMin, col: 0, cols: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const colEnds: number[] = []
  for (const item of items) {
    let col = colEnds.findIndex((end) => end <= item.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(item.endMin)
    } else {
      colEnds[col] = item.endMin
    }
    item.col = col
  }
  for (const item of items) {
    const overlapping = items.filter((other) => other.startMin < item.endMin && other.endMin > item.startMin)
    item.cols = Math.max(1, ...overlapping.map((other) => other.col + 1))
  }
  return items
}

type Bar = { event: CalendarEvent; colStart: number; colSpan: number; lane: number }

function packBars(events: CalendarEvent[], days: Date[]): { bars: Bar[]; lanes: number } {
  const origin = startOfDay(days[0] ?? new Date())
  const last = addDays(startOfDay(days[days.length - 1] ?? origin), 1)
  const candidates = events
    .filter(isBarEvent)
    .map((event) => {
      const start = event.start < origin ? origin : startOfDay(event.start)
      const end = event.end > last ? last : event.end
      const colStart = differenceInCalendarDays(start, origin)
      const colSpan = Math.max(1, differenceInCalendarDays(end, start))
      return { event, colStart, colSpan, lane: 0 }
    })
    .filter((bar) => bar.colStart < days.length && bar.colStart + bar.colSpan > 0)
    .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan)

  const laneEnds: number[] = []
  for (const bar of candidates) {
    const start = Math.max(0, bar.colStart)
    const end = Math.min(days.length, bar.colStart + bar.colSpan)
    bar.colStart = start
    bar.colSpan = Math.max(1, end - start)
    let lane = laneEnds.findIndex((occupied) => occupied <= bar.colStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(bar.colStart + bar.colSpan)
    } else {
      laneEnds[lane] = bar.colStart + bar.colSpan
    }
    bar.lane = lane
  }
  return { bars: candidates, lanes: Math.max(1, laneEnds.length) }
}

function EventChip({
  event,
  compact,
  onClick,
}: {
  event: CalendarEvent
  compact?: boolean
  onClick?: (event: CalendarEvent) => void
}) {
  return (
    <button
      type="button"
      data-testid={`calendar-event-${event.id}`}
      className={cn(
        "w-full truncate rounded-sm bg-primary/15 px-1 text-left text-[11px] text-primary",
        compact ? "h-5 leading-5" : "py-0.5"
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(event)
      }}
    >
      {event.allDay ? event.title : `${format(event.start, "HH:mm")} ${event.title}`}
    </button>
  )
}

function EventDialog({
  draft,
  onOpenChange,
  onSave,
  onDelete,
}: {
  draft: Draft | null
  onOpenChange: (open: boolean) => void
  onSave: (next: { title: string; start: Date; end: Date; allDay: boolean }) => void
  onDelete?: () => void
}) {
  const t = useLabels("eventCalendar")
  const [title, setTitle] = React.useState("")
  const [allDay, setAllDay] = React.useState(false)
  const [range, setRange] = React.useState<{ start?: Date; end?: Date }>({})

  React.useEffect(() => {
    if (!draft) return
    setTitle(draft.event?.title ?? "")
    setAllDay(draft.allDay)
    setRange({
      start: draft.start,
      end: draft.allDay ? inclusiveAllDayEnd(draft.end) : draft.end,
    })
  }, [draft])

  const setAllDayLinked = (next: boolean) => {
    setAllDay(next)
    if (!range.start) return
    if (next) {
      setRange({
        start: startOfDay(range.start),
        end: startOfDay(range.end ?? range.start),
      })
      return
    }
    const start = applyTime(range.start, "09:00")
    let end = applyTime(range.end ?? range.start, "10:00")
    if (end <= start) end = addMinutes(start, 60)
    setRange({ start, end })
  }

  const save = () => {
    if (!range.start || !title.trim()) return
    if (allDay) {
      const start = startOfDay(range.start)
      const last = range.end ?? range.start
      const end = exclusiveAllDayEnd(last < start ? start : last)
      onSave({ title: title.trim(), start, end, allDay: true })
      return
    }
    const start = range.start
    let end = range.end ?? addMinutes(start, 30)
    if (end <= start) end = addMinutes(start, 30)
    onSave({ title: title.trim(), start, end, allDay: false })
  }

  return (
    <Dialog open={draft != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="event-dialog">
        <DialogHeader>
          <DialogTitle>{draft?.event ? t.editEvent : t.newEvent}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            data-testid="event-title-input"
            placeholder={t.eventTitle}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save()
            }}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="event-all-day"
              checked={allDay}
              onCheckedChange={(checked) => setAllDayLinked(checked === true)}
            />
            <Label htmlFor="event-all-day" id="event-all-day-label">
              {t.allDay}
            </Label>
          </div>
          <DateTimeRangePicker value={range} onChange={setRange} allDay={allDay} />
        </div>
        <DialogFooter className={draft?.event ? "sm:justify-between" : undefined}>
          {draft?.event && onDelete ? (
            <Button variant="destructive" onClick={onDelete}>
              {t.delete}
            </Button>
          ) : (
            <span />
          )}
          <Button data-testid="event-save" onClick={save}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function monthDayKey(day: Date) {
  return format(day, "yyyy-MM-dd")
}

function orderedDays(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? [a, b] : [b, a]
}

function MonthView({
  current,
  events,
  onSelectRange,
  onEventClick,
}: {
  current: Date
  events: CalendarEvent[]
  onSelectRange: (range: { start: Date; end: Date; allDay: boolean }) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const t = useLabels("eventCalendar")
  const monthStart = startOfWeek(startOfMonth(current), { weekStartsOn: WEEK_STARTS_ON })
  const monthEnd = endOfWeek(endOfMonth(current), { weekStartsOn: WEEK_STARTS_ON })
  const days: Date[] = []
  for (let day = monthStart; day <= monthEnd; day = addDays(day, 1)) days.push(day)
  const [draft, setDraft] = React.useState<{ start: Date; end: Date } | null>(null)
  const draftRef = React.useRef(draft)
  draftRef.current = draft

  const dayFromPoint = (clientX: number, clientY: number) => {
    const node = document.elementFromPoint(clientX, clientY)?.closest("[data-month-day]")
    const key = node?.getAttribute("data-month-day")
    return key ? startOfDay(new Date(`${key}T00:00:00`)) : null
  }

  const commit = () => {
    const next = draftRef.current
    if (!next) return
    const [start, end] = orderedDays(next.start, next.end)
    onSelectRange({ start, end: addDays(end, 1), allDay: true })
    setDraft(null)
  }

  return (
    <>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {t.weekdays.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7"
        data-testid="calendar-month-grid"
        onPointerMove={(event) => {
          if (!draftRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          const day = dayFromPoint(event.clientX, event.clientY)
          if (day) setDraft({ ...draftRef.current, end: day })
        }}
        onPointerUp={commit}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) => eventTouchesDay(event, day))
          const visible = dayEvents.slice(0, MONTH_MAX)
          const overflow = dayEvents.length - visible.length
          const selected =
            draft &&
            day >= orderedDays(draft.start, draft.end)[0] &&
            day <= orderedDays(draft.start, draft.end)[1]
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              data-month-day={monthDayKey(day)}
              data-testid={`calendar-month-day-${monthDayKey(day)}`}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return
                event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId)
                setDraft({ start: startOfDay(day), end: startOfDay(day) })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelectRange({
                    start: startOfDay(day),
                    end: addDays(startOfDay(day), 1),
                    allDay: true,
                  })
                }
              }}
              className={cn(
                "min-h-24 border-t border-r p-1 text-left text-xs last:border-r-0",
                !isSameMonth(day, current) && "bg-muted/30 text-muted-foreground",
                isToday(day) && "bg-primary/5",
                selected && "bg-primary/15"
              )}
            >
              <div className={cn("mb-1 font-medium", isToday(day) && "text-primary")}>{format(day, "d")}</div>
              <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                  <EventChip key={event.id} event={event} compact onClick={onEventClick} />
                ))}
                {overflow > 0 ? (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="calendar-more"
                          className="text-muted-foreground h-auto px-1 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                    >
                      {t.more(overflow)}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2">
                      <div className="mb-1 text-xs font-medium">{format(day, "EEE MMM d")}</div>
                      <div className="flex flex-col gap-1">
                        {dayEvents.map((event) => (
                          <EventChip key={event.id} event={event} onClick={onEventClick} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function TimeGrid({
  days,
  events,
  onSelectRange,
  onEventClick,
}: {
  days: Date[]
  events: CalendarEvent[]
  onSelectRange: (range: { start: Date; end: Date; allDay: boolean }) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const t = useLabels("eventCalendar")
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [draft, setDraft] = React.useState<{ day: Date; startMin: number; endMin: number } | null>(null)
  const draftRef = React.useRef(draft)
  draftRef.current = draft
  const [barDraft, setBarDraft] = React.useState<{ start: number; end: number } | null>(null)
  const barDraftRef = React.useRef(barDraft)
  barDraftRef.current = barDraft
  const { bars, lanes } = packBars(events, days)

  React.useEffect(() => {
    scrollerRef.current?.scrollTo?.({ top: 8 * HOUR_HEIGHT })
  }, [days[0]?.toDateString()])

  const minutesFromPointer = (event: React.PointerEvent, column: HTMLElement) => {
    const rect = column.getBoundingClientRect()
    const y = event.clientY - rect.top
    return snapMinutes((y / (24 * HOUR_HEIGHT)) * 24 * 60)
  }

  const commitTimed = () => {
    const next = draftRef.current
    if (!next) return
    const startMin = Math.min(next.startMin, next.endMin)
    const endMin = Math.max(next.startMin, next.endMin)
    const end = endMin === startMin ? startMin + 30 : endMin
    onSelectRange({
      start: atMinutes(next.day, startMin),
      end: atMinutes(next.day, Math.min(24 * 60, end)),
      allDay: false,
    })
    setDraft(null)
  }

  const indexFromX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / Math.max(rect.width, 1)
    return Math.min(days.length - 1, Math.max(0, Math.floor(ratio * days.length)))
  }

  const commitBar = () => {
    const next = barDraftRef.current
    if (!next) return
    const startIndex = Math.min(next.start, next.end)
    const endIndex = Math.max(next.start, next.end)
    const start = days[startIndex]
    const end = days[endIndex]
    if (!start || !end) return
    onSelectRange({
      start: startOfDay(start),
      end: addDays(startOfDay(end), 1),
      allDay: true,
    })
    setBarDraft(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="calendar-week-grid">
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn("px-2 py-1.5 text-center text-xs", isToday(day) && "text-primary")}
          >
            <div className="text-muted-foreground font-medium">{format(day, "EEE")}</div>
            <div className={cn("text-sm", isToday(day) && "font-semibold")}>{format(day, "d")}</div>
          </div>
        ))}
      </div>

      <div
        className="grid shrink-0 border-b"
        data-testid="calendar-all-day"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="text-muted-foreground px-1 py-1 text-[10px] leading-4">{t.allDay}</div>
        <div
          className="relative"
          style={{ gridColumn: `2 / span ${days.length}`, minHeight: lanes * 22 + 8 }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("[data-event-block]")) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const index = indexFromX(event.clientX, event.currentTarget)
            setBarDraft({ start: index, end: index })
          }}
          onPointerMove={(event) => {
            if (!barDraftRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
            setBarDraft({
              ...barDraftRef.current,
              end: indexFromX(event.clientX, event.currentTarget),
            })
          }}
          onPointerUp={commitBar}
        >
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day, index) => {
              const selected =
                barDraft &&
                index >= Math.min(barDraft.start, barDraft.end) &&
                index <= Math.max(barDraft.start, barDraft.end)
              return (
                <div
                  key={day.toISOString()}
                  className={cn("border-l", selected ? "bg-primary/15" : "hover:bg-muted/30")}
                />
              )
            })}
          </div>
          {bars.map((bar) => (
            <button
              key={bar.event.id}
              type="button"
              data-event-block
              data-testid={`calendar-event-${bar.event.id}`}
              className="absolute truncate rounded-sm bg-primary/20 px-1 text-left text-[11px] text-primary"
              style={{
                top: 4 + bar.lane * 22,
                height: 20,
                left: `calc(${(bar.colStart / days.length) * 100}% + 2px)`,
                width: `calc(${(bar.colSpan / days.length) * 100}% - 4px)`,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onEventClick(bar.event)
              }}
            >
              {bar.event.title}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
            height: 24 * HOUR_HEIGHT,
          }}
        >
          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="text-muted-foreground -mt-2 pr-2 text-right text-[10px]"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const packed = packDay(events, day)
            const now = new Date()
            const showNow = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className="relative border-l"
                data-testid={`calendar-day-col-${format(day, "yyyy-MM-dd")}`}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest("[data-event-block]")) return
                  const column = event.currentTarget
                  column.setPointerCapture?.(event.pointerId)
                  const minutes = minutesFromPointer(event, column)
                  setDraft({ day, startMin: minutes, endMin: minutes })
                }}
                onPointerMove={(event) => {
                  if (!draftRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
                  const minutes = minutesFromPointer(event, event.currentTarget)
                  setDraft({ ...draftRef.current, endMin: minutes })
                }}
                onPointerUp={() => commitTimed()}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="border-t border-border/60" style={{ height: HOUR_HEIGHT }} />
                ))}
                {packed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-event-block
                    data-testid={`calendar-event-${item.id}`}
                    className="absolute overflow-hidden rounded-sm bg-primary/20 px-1 py-0.5 text-left text-[11px] text-primary ring-1 ring-primary/20"
                    style={{
                      top: (item.startMin / 60) * HOUR_HEIGHT,
                      height: Math.max(16, ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT),
                      left: `calc(${(item.col / item.cols) * 100}% + 2px)`,
                      width: `calc(${(1 / item.cols) * 100}% - 4px)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(item)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="truncate font-medium">{item.title}</div>
                    {item.endMin - item.startMin >= 45 ? (
                      <div className="text-primary/80 truncate">
                        {format(item.start, "HH:mm")}–{format(item.end, "HH:mm")}
                      </div>
                    ) : null}
                  </button>
                ))}
                {draft && isSameDay(draft.day, day) ? (
                  <div
                    className="pointer-events-none absolute left-1 right-1 rounded-sm bg-primary/25 ring-1 ring-primary/40"
                    style={{
                      top: (Math.min(draft.startMin, draft.endMin) / 60) * HOUR_HEIGHT,
                      height: Math.max(
                        HOUR_HEIGHT / 4,
                        (Math.abs(draft.endMin - draft.startMin) / 60) * HOUR_HEIGHT
                      ),
                    }}
                  />
                ) : null}
                {showNow ? (
                  <div
                    className="pointer-events-none absolute right-0 left-0 z-10 flex items-center"
                    style={{ top: (minutesOfDay(now) / 60) * HOUR_HEIGHT }}
                  >
                    <span className="bg-destructive size-1.5 rounded-full" />
                    <span className="bg-destructive h-px flex-1" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Month / week / day calendar. Event shape: { id, title, start, end, allDay? }.
 * Drag empty slots to create; click event to edit. Week/day have all-day row.
 * @when Scheduling, on-call, release windows
 * @example
 * <EventCalendar events={events} onEventsChange={setEvents} view="week" />
 */
export function EventCalendar({
  value,
  onValueChange,
  view = "month",
  onViewChange,
  events,
  onEventsChange,
  onDayClick,
  onEventClick,
  className,
}: {
  value?: Date
  onValueChange?: (date: Date) => void
  view?: CalendarView
  onViewChange?: (view: CalendarView) => void
  events: CalendarEvent[]
  onEventsChange?: (events: CalendarEvent[]) => void
  onDayClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  className?: string
}) {
  const [cursor, setCursor] = React.useState(value ?? new Date())
  const current = value ?? cursor
  const setCurrent = (date: Date) => {
    setCursor(date)
    onValueChange?.(date)
  }
  const [innerView, setInnerView] = React.useState(view)
  React.useEffect(() => setInnerView(view), [view])
  const currentView = innerView
  const setView = (next: CalendarView) => {
    setInnerView(next)
    onViewChange?.(next)
  }
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const t = useLabels("eventCalendar")
  const dateLocale = useDateLocale()

  const openCreate = (range: { start: Date; end: Date; allDay: boolean }) => {
    onDayClick?.(range.start)
    if (!onEventsChange) return
    setDraft(range)
  }

  const openEvent = (event: CalendarEvent) => {
    onEventClick?.(event)
    if (!onEventsChange) return
    setDraft({ start: event.start, end: event.end, allDay: Boolean(event.allDay), event })
  }

  const weekStart = startOfWeek(current, { weekStartsOn: WEEK_STARTS_ON })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayDays = [startOfDay(current)]

  const heading =
    currentView === "day"
      ? format(current, "EEEE, MMM d", { locale: dateLocale })
      : currentView === "week"
        ? `${format(weekStart, "MMM d", { locale: dateLocale })} – ${format(addDays(weekStart, 6), "MMM d", { locale: dateLocale })}`
        : format(current, "MMMM yyyy", { locale: dateLocale })

  const shift = (dir: number) => {
    if (currentView === "month") setCurrent(addMonths(current, dir))
    else if (currentView === "week") setCurrent(addWeeks(current, dir))
    else setCurrent(addDays(current, dir))
  }

  return (
    <div
      data-testid="event-calendar"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        currentView === "month" ? "" : "h-[620px]",
        className
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="text-sm font-medium">{heading}</div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setCurrent(new Date())}>
            {t.today}
          </Button>
          <Button size="sm" variant="outline" onClick={() => shift(-1)}>
            {t.prev}
          </Button>
          <Button size="sm" variant="outline" onClick={() => shift(1)}>
            {t.next}
          </Button>
          {(["month", "week", "day"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={currentView === item ? "default" : "outline"}
              data-testid={`calendar-view-${item}`}
              onClick={() => setView(item)}
            >
              {t[item]}
            </Button>
          ))}
        </div>
      </div>

      {currentView === "month" ? (
        <MonthView
          current={current}
          events={events}
          onSelectRange={openCreate}
          onEventClick={openEvent}
        />
      ) : (
        <TimeGrid
          days={currentView === "week" ? weekDays : dayDays}
          events={events}
          onSelectRange={openCreate}
          onEventClick={openEvent}
        />
      )}

      <EventDialog
        draft={draft}
        onOpenChange={(open) => !open && setDraft(null)}
        onSave={(next) => {
          if (!onEventsChange) return
          if (draft?.event) {
            onEventsChange(
              events.map((event) => (event.id === draft.event?.id ? { ...event, ...next } : event))
            )
          } else {
            onEventsChange([...events, { id: `evt-${Date.now()}`, ...next }])
          }
          setDraft(null)
        }}
        onDelete={
          draft?.event
            ? () => {
                onEventsChange?.(events.filter((event) => event.id !== draft.event?.id))
                setDraft(null)
              }
            : undefined
        }
      />
    </div>
  )
}
