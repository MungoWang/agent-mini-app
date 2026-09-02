"use client"

import { addMinutes, format, set } from "date-fns"
import { type ReactNode, useEffect, useMemo, useState } from "react"

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
import { Textarea } from "@monkey-mini-app/ui/components/textarea"
import { DateTimePicker } from "@monkey-mini-app/ui/composites/date-time-picker"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

import { COLORS } from "../constants"
import { useCalendar } from "../contexts/calendar-context"
import { useDisclosure } from "../hooks"
import type { IEvent } from "../interfaces"
import type { TEventColor } from "../types"

interface IProps {
  children?: ReactNode
  startDate?: Date
  startTime?: { hour: number; minute: number }
  endTime?: { hour: number; minute: number }
  event?: IEvent
  /** Controlled open (e.g. after drag-select). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddEditEventDialog({
  children,
  startDate,
  startTime,
  endTime,
  event,
  open: openProp,
  onOpenChange,
}: IProps) {
  const disclosure = useDisclosure()
  const isControlled = openProp !== undefined
  const isOpen = isControlled ? Boolean(openProp) : disclosure.isOpen
  const onClose = () => {
    if (isControlled) onOpenChange?.(false)
    else disclosure.onClose()
  }
  const onToggle = () => {
    if (isControlled) onOpenChange?.(!openProp)
    else disclosure.onToggle()
  }
  const { addEvent, updateEvent, users } = useCalendar()
  const t = useLabels("eventCalendar")
  const isEditing = Boolean(event)

  const initial = useMemo(() => {
    if (event) {
      return {
        title: event.title,
        description: event.description,
        start: new Date(event.startDate),
        end: new Date(event.endDate),
        color: event.color,
      }
    }
    const base = startDate ? new Date(startDate) : new Date()
    const start = startTime
      ? set(base, { hours: startTime.hour, minutes: startTime.minute, seconds: 0, milliseconds: 0 })
      : base
    const end = endTime
      ? set(base, { hours: endTime.hour, minutes: endTime.minute, seconds: 0, milliseconds: 0 })
      : addMinutes(start, 30)
    return {
      title: "",
      description: "",
      start,
      end: end > start ? end : addMinutes(start, 30),
      color: "blue" as TEventColor,
    }
  }, [event, startDate, startTime, endTime])

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [color, setColor] = useState<TEventColor>(initial.color)

  useEffect(() => {
    setTitle(initial.title)
    setDescription(initial.description)
    setStart(initial.start)
    setEnd(initial.end)
    setColor(initial.color)
  }, [initial])

  const save = () => {
    if (!title.trim() || !start || !end) return
    const payload: IEvent = {
      id: isEditing && event ? event.id : Date.now(),
      title: title.trim(),
      description: description.trim(),
      startDate: format(start, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(end, "yyyy-MM-dd'T'HH:mm:ss"),
      color,
      user: event?.user ?? users[0] ?? { id: "local", name: "Me", picturePath: null },
    }
    if (isEditing) updateEvent(payload)
    else addEvent(payload)
    onClose()
  }

  return (
    <>
      {children ? (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {children}
        </span>
      ) : null}
      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) onClose()
          else if (isControlled) onOpenChange?.(true)
          else disclosure.onOpen()
        }}
      >
        <DialogContent className="sm:max-w-lg" data-testid="event-dialog">
          <DialogHeader>
            <DialogTitle>{isEditing ? t.editEvent : t.newEvent}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              data-testid="event-title-input"
              placeholder={t.titlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save()
              }}
            />
            <div className="grid gap-1">
              <Label>{t.start}</Label>
              <DateTimePicker value={start} onChange={(d) => d && setStart(d)} />
            </div>
            <div className="grid gap-1">
              <Label>{t.end}</Label>
              <DateTimePicker value={end} onChange={(d) => d && setEnd(d)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "size-6 rounded-full border",
                    color === item ? "ring-2 ring-ring" : "opacity-70",
                    `bg-${item}-600`,
                  )}
                  style={{ backgroundColor: item }}
                  onClick={() => setColor(item)}
                  aria-label={item}
                />
              ))}
            </div>
            <Textarea placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button data-testid="event-save" onClick={save}>
              {isEditing ? t.saveChanges : t.createEvent}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
