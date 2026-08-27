import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "./status-badge"

describe("StatusBadge", () => {
  it("maps known statuses", () => {
    render(<StatusBadge status="pass" />)
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "pass")
    expect(screen.getByTestId("status-badge")).toHaveTextContent("pass")
  })

  it("falls back for unknown status", () => {
    render(<StatusBadge status="weird" />)
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "weird")
  })
})
