// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HOUR_HEIGHT_PX } from "../helpers"
import { useTimeRangeCreate } from "./use-time-range-create"

const DAY = new Date("2026-08-26T00:00:00")

function rect(top: number, height: number): DOMRect {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function column(top = 131): HTMLElement {
  const el = document.createElement("div")
  el.getBoundingClientRect = () => rect(top, 24 * HOUR_HEIGHT_PX)
  document.body.append(el)
  return el
}

function event(type: string, clientY: number, pointerId = 1) {
  return {
    type,
    button: 0,
    pointerId,
    clientY,
    target: document.body,
    preventDefault: () => {},
    currentTarget: document.body,
  } as unknown as React.PointerEvent<HTMLElement>
}

describe("useTimeRangeCreate", () => {
  it("maps pixels to time using HOUR_HEIGHT_PX (96px == one hour)", () => {
    const { result } = renderHook(() => useTimeRangeCreate())
    const col = column()
    act(() => result.current.onPointerDown(event("pointerdown", 131 + 100), DAY, col))
    act(() => result.current.onPointerMove(event("pointermove", 131 + 196)))

    // y=100 → 62.5 → snap 60;  y=196 → 122.5 → snap 120
    expect(result.current.selection).toEqual({ day: DAY, startMin: 60, endMin: 120 })
    const overlay = result.current.overlayStyle as { top: number; height: number }
    expect(overlay.height).toBe(HOUR_HEIGHT_PX)
    col.remove()
  })

  it("keeps the column geometry when the column node is replaced mid-drag", () => {
    // Regression: the week view used to remount its columns on every state
    // change. A detached element reports an all-zero DOMRect, so `clientY - 0`
    // counted minutes from the top of the viewport and a small drag turned into
    // a multi-hour selection.
    const { result } = renderHook(() => useTimeRangeCreate())
    const col = column()
    act(() => result.current.onPointerDown(event("pointerdown", 131 + 100), DAY, col))
    col.remove()
    act(() => result.current.onPointerMove(event("pointermove", 131 + 196)))
    expect(result.current.selection).toEqual({ day: DAY, startMin: 60, endMin: 120 })

    act(() => result.current.onPointerUp(event("pointerup", 131 + 196)))
    const draft = result.current.draft
    expect(draft?.start.getHours()).toBe(1)
    expect((draft!.end.getTime() - draft!.start.getTime()) / 60_000).toBe(60)
  })

  it("follows the column while an ancestor scrolls it", () => {
    const { result } = renderHook(() => useTimeRangeCreate())
    const col = column(131)
    act(() => result.current.onPointerDown(event("pointerdown", 131 + 100), DAY, col))
    const scrolled = result.current.selection
    col.getBoundingClientRect = () => rect(31, 24 * HOUR_HEIGHT_PX) // scrolled by 100px
    // Same clock position, new viewport offset → same start minute (the +30 is the
    // minimum block a press without dragging gets).
    act(() => result.current.onPointerMove(event("pointermove", 31 + 100)))
    expect(result.current.selection?.startMin).toBe(scrolled?.startMin)
    expect(result.current.selection?.endMin).toBe((scrolled?.startMin ?? 0) + 30)
    col.remove()
  })

  it("treats a plain click as a 30 minute slot", () => {
    const { result } = renderHook(() => useTimeRangeCreate())
    const col = column()
    act(() => result.current.onPointerDown(event("pointerdown", 131 + 96), DAY, col))
    act(() => result.current.onPointerUp(event("pointerup", 131 + 96)))
    const draft = result.current.draft
    expect(draft?.start.getHours()).toBe(1)
    expect((draft!.end.getTime() - draft!.start.getTime()) / 60_000).toBe(30)
    col.remove()
  })
})
