import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TimezoneSelect } from "./timezone-select"

const hidden = { hidden: true } as const

describe("TimezoneSelect", () => {
  it("opens a searchable list instead of a native select", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimezoneSelect value="Asia/Shanghai" onChange={onChange} />)
    await user.click(screen.getByTestId("timezone-select"))
    const search = screen.getByTestId("timezone-search")
    await user.type(search, "Tokyo")
    await user.click(screen.getByRole("option", { name: /Tokyo/i, ...hidden }))
    expect(onChange).toHaveBeenCalledWith("Asia/Tokyo")
  })

  it("keeps the full IANA list out of the default menu", async () => {
    const user = userEvent.setup()
    render(<TimezoneSelect value="Asia/Shanghai" />)
    await user.click(screen.getByTestId("timezone-select"))
    expect(screen.queryByRole("option", { name: /Seoul/i, ...hidden })).not.toBeInTheDocument()
    expect(screen.getByText(/Type to search \d+ timezones/)).toBeInTheDocument()
    await user.type(screen.getByTestId("timezone-search"), "Seoul")
    expect(screen.getByRole("option", { name: /Seoul/i, ...hidden })).toBeInTheDocument()
  })
})
