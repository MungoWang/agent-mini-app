import { set as setTime } from "date-fns"
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { HOUR_HEIGHT_PX } from "../helpers"

export type TimeRangeDraft = {
  start: Date
  end: Date
}

type Selection = {
  day: Date
  startMin: number
  endMin: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function snapMinutes(raw: number, step = 15) {
  return Math.round(raw / step) * step
}

function minutesToDate(day: Date, minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return setTime(day, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
}

/** Drag on a day column to select a time range (Google Calendar style). */
export function useTimeRangeCreate() {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [draft, setDraft] = useState<TimeRangeDraft | null>(null)
  const selectionRef = useRef<Selection | null>(null)
  const dragRef = useRef<{
    day: Date
    originMin: number
    moved: boolean
    pointerId: number
  } | null>(null)
  const colRef = useRef<HTMLElement | null>(null)

  const updateSelection = useCallback((next: Selection | null) => {
    selectionRef.current = next
    setSelection(next)
  }, [])

  const yToMinutes = useCallback((clientY: number, el: HTMLElement) => {
    // getBoundingClientRect tracks scroll of ancestors; do not add scrollTop again.
    const rect = el.getBoundingClientRect()
    const y = clientY - rect.top
    return clamp(snapMinutes((y / HOUR_HEIGHT_PX) * 60), 0, 24 * 60)
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, day: Date, columnEl: HTMLElement) => {
      // Only primary button; ignore when starting on an existing event.
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (target?.closest("[data-calendar-event],button,a,input,textarea")) return

      e.preventDefault()
      columnEl.setPointerCapture(e.pointerId)
      colRef.current = columnEl
      const originMin = yToMinutes(e.clientY, columnEl)
      dragRef.current = { day, originMin, moved: false, pointerId: e.pointerId }
      updateSelection({ day, startMin: originMin, endMin: originMin + 30 })
    },
    [updateSelection, yToMinutes],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      const el = colRef.current
      if (!drag || !el) return
      const mins = yToMinutes(e.clientY, el)
      if (Math.abs(mins - drag.originMin) >= 15) drag.moved = true
      const startMin = Math.min(drag.originMin, mins)
      const endMin = Math.max(drag.originMin, mins)
      updateSelection({
        day: drag.day,
        startMin,
        endMin: endMin === startMin ? startMin + 30 : endMin,
      })
    },
    [updateSelection, yToMinutes],
  )

  const finish = useCallback(() => {
    const drag = dragRef.current
    const sel = selectionRef.current
    dragRef.current = null
    colRef.current = null
    updateSelection(null)
    if (!drag || !sel) return

    const startMin = Math.min(sel.startMin, sel.endMin)
    let endMin = Math.max(sel.startMin, sel.endMin)
    // Click without drag → default 30 minutes.
    if (!drag.moved || endMin - startMin < 15) endMin = startMin + 30
    if (endMin > 24 * 60) endMin = 24 * 60

    setDraft({
      start: minutesToDate(sel.day, startMin),
      end: minutesToDate(sel.day, endMin),
    })
  }, [updateSelection])

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current) return
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      finish()
    },
    [finish],
  )

  const clearDraft = useCallback(() => setDraft(null), [])

  const overlayStyle =
    selection == null
      ? null
      : {
          top: (Math.min(selection.startMin, selection.endMin) / 60) * HOUR_HEIGHT_PX,
          height:
            (Math.abs(selection.endMin - selection.startMin) / 60) * HOUR_HEIGHT_PX ||
            HOUR_HEIGHT_PX / 2,
        }

  return {
    selection,
    draft,
    clearDraft,
    overlayStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
