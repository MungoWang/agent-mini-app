import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TimePicker } from "./time-picker"

describe("TimePicker", () => {
  it("does not change the value when opened", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimePicker value="09:30" onChange={onChange} />)
    await user.click(screen.getByTestId("time-picker"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("emits HH:mm from the wheel popover", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimePicker value="09:00" onChange={onChange} />)
    await user.click(screen.getByTestId("time-picker"))
    await user.click(within(screen.getByTestId("time-picker-hour")).getByText("14"))
    expect(onChange).toHaveBeenCalledWith("14:00")
    await user.click(within(screen.getByTestId("time-picker-minute")).getByText("30"))
    expect(onChange).toHaveBeenCalledWith("14:30")
  })
})
