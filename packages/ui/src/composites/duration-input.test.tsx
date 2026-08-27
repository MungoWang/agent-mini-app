import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DurationInput } from "./duration-input"

describe("DurationInput", () => {
  it("increments hours", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DurationInput value="2h 30m" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Increase h" }))
    expect(onChange).toHaveBeenCalledWith("3h 30m", 210)
  })

  it("wraps minutes into hours", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DurationInput value="1h 59m" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Increase m" }))
    expect(onChange).toHaveBeenCalledWith("2h", 120)
  })
})
