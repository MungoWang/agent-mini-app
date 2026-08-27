import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DiffViewer } from "./diff-viewer"

describe("DiffViewer", () => {
  it("shows added and removed lines", () => {
    render(<DiffViewer original={"a\n"} modified={"b\n"} />)
    expect(screen.getByTestId("diff-viewer").textContent).toMatch(/-a/)
    expect(screen.getByTestId("diff-viewer").textContent).toMatch(/\+b/)
  })

  it("supports split mode", () => {
    render(<DiffViewer original={"a\n"} modified={"b\n"} mode="split" />)
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute("data-mode", "split")
  })
})
