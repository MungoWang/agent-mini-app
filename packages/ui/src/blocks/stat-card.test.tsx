import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatCard } from "./stat-card"

describe("StatCard", () => {
  it("renders title value and delta", () => {
    render(<StatCard title="Runs" value="128" delta="+12%" trend="up" />)
    expect(screen.getByTestId("stat-card-value")).toHaveTextContent("128")
    expect(screen.getByTestId("stat-card-delta")).toHaveTextContent("+12%")
    expect(screen.getByText("Runs")).toBeInTheDocument()
  })
})
