import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { NumberField } from "./number-field"

describe("NumberField", () => {
  it("increments", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<NumberField value={1} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Increase" }))
    expect(onChange).toHaveBeenCalledWith(2)
  })
})
