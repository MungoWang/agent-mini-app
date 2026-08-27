import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { DateTimePicker } from "./date-time-picker"

describe("DateTimePicker", () => {
  it("opens calendar with hour and minute wheels", async () => {
    const user = userEvent.setup()
    render(<DateTimePicker value={new Date("2026-08-26T09:15:00")} />)
    expect(screen.getByTestId("date-time-picker")).toBeInTheDocument()
    await user.click(screen.getByTestId("date-picker-trigger"))
    expect(screen.getByTestId("date-chrome")).toBeInTheDocument()
    expect(screen.getByTestId("time-hour")).toBeInTheDocument()
    expect(screen.getByTestId("time-minute")).toBeInTheDocument()
    expect(screen.getByTestId("date-chrome-today")).toBeInTheDocument()
  })
})
