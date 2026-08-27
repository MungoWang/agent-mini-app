import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EventCalendar, type CalendarEvent } from "./event-calendar"

const sample: CalendarEvent[] = [
  {
    id: "e1",
    title: "Standup",
    start: new Date("2026-08-26T09:00:00"),
    end: new Date("2026-08-26T09:30:00"),
  },
  {
    id: "e2",
    title: "Oncall",
    start: new Date("2026-08-26"),
    end: new Date("2026-08-28"),
    allDay: true,
  },
]

describe("EventCalendar", () => {
  it("renders an Outlook-style week time grid with an all-day row", async () => {
    const user = userEvent.setup()
    render(
      <EventCalendar value={new Date("2026-08-26")} view="month" events={sample} />
    )
    await user.click(screen.getByTestId("calendar-view-week"))
    expect(screen.getByTestId("calendar-week-grid")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-all-day")).toBeInTheDocument()
    expect(screen.getByText("09:00")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-event-e2")).toHaveTextContent("Oncall")
  })

  it("opens an editor with start and end fields", async () => {
    const onEventsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <EventCalendar
        value={new Date("2026-08-26")}
        view="week"
        events={sample}
        onEventsChange={onEventsChange}
      />
    )
    await user.click(screen.getByTestId("calendar-event-e1"))
    expect(screen.getByTestId("event-dialog")).toBeInTheDocument()
    expect(screen.getByText("Edit event")).toBeInTheDocument()
    expect(screen.getByText("Start")).toBeInTheDocument()
    expect(screen.getByText("End")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /all day/i })).toBeInTheDocument()
    await user.clear(screen.getByTestId("event-title-input"))
    await user.type(screen.getByTestId("event-title-input"), "Standup 2")
    await user.click(screen.getByTestId("event-save"))
    expect(onEventsChange).toHaveBeenCalled()
    const next = onEventsChange.mock.calls[0]?.[0] as CalendarEvent[]
    expect(next.find((event) => event.id === "e1")?.title).toBe("Standup 2")
  })

  it("opens an all-day range editor from a month day", async () => {
    const onEventsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <EventCalendar
        value={new Date("2026-08-26")}
        view="month"
        events={sample}
        onEventsChange={onEventsChange}
      />
    )
    await user.click(screen.getByTestId("calendar-month-day-2026-08-26"))
    expect(screen.getByTestId("event-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("date-time-range-picker")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /all day/i })).toBeChecked()
  })

  it("shows +N more when a month cell overflows", async () => {
    const user = userEvent.setup()
    const crowded: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      title: `Item ${i}`,
      start: new Date(`2026-08-26T${String(8 + i).padStart(2, "0")}:00:00`),
      end: new Date(`2026-08-26T${String(9 + i).padStart(2, "0")}:00:00`),
    }))
    render(
      <EventCalendar value={new Date("2026-08-26")} view="month" events={crowded} />
    )
    expect(screen.getByTestId("calendar-more")).toHaveTextContent("+2 more")
    await user.click(screen.getByTestId("calendar-more"))
    expect(screen.getByText(/Item 3/)).toBeInTheDocument()
  })
})
