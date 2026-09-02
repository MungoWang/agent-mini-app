import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it } from "vitest"

import { EventCalendar, type CalendarEvent } from "./event-calendar"

const user = { id: "u1", name: "Ada", picturePath: null }

const sample: CalendarEvent[] = [
  {
    id: 1,
    title: "Standup",
    startDate: "2026-08-26T09:00:00",
    endDate: "2026-08-26T09:30:00",
    color: "blue",
    description: "",
    user,
  },
  {
    id: 2,
    title: "Oncall",
    startDate: "2026-08-26T00:00:00",
    endDate: "2026-08-28T00:00:00",
    color: "green",
    description: "coverage",
    user,
  },
]

describe("EventCalendar", () => {
  beforeAll(() => {
    // jsdom lacks Web Animations used by ScrollArea
    Element.prototype.getAnimations = () => []
  })

  it("renders month events and can switch to week", async () => {
    const click = userEvent.setup()
    render(<EventCalendar events={sample} view="month" date={new Date("2026-08-26")} />)
    expect(screen.getByTestId("event-calendar")).toBeInTheDocument()
    expect(screen.getByText("Standup")).toBeInTheDocument()
    await click.click(screen.getByTestId("calendar-view-week"))
    expect(screen.getByTestId("calendar-week-grid")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-all-day")).toBeInTheDocument()
    expect(screen.getAllByTestId("calendar-event-2")[0]).toHaveTextContent("Oncall")
  })

  it("opens add-event dialog", async () => {
    const click = userEvent.setup()
    render(<EventCalendar events={sample} view="month" date={new Date("2026-08-26")} />)
    await click.click(screen.getByTestId("calendar-add-event"))
    expect(screen.getByTestId("event-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("event-title-input")).toBeInTheDocument()
  })
})
