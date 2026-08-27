import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Stepper } from "./stepper"

describe("Stepper", () => {
  it("marks the current step", () => {
    render(
      <Stepper
        current={1}
        steps={[
          { id: "a", title: "One" },
          { id: "b", title: "Two" },
        ]}
      />
    )
    expect(screen.getByTestId("stepper")).toHaveTextContent("Two")
  })

  it("renders horizontal", () => {
    render(
      <Stepper
        orientation="horizontal"
        current={0}
        steps={[
          { id: "a", title: "One" },
          { id: "b", title: "Two" },
        ]}
      />
    )
    expect(screen.getByTestId("stepper")).toHaveAttribute("data-orientation", "horizontal")
  })
})
