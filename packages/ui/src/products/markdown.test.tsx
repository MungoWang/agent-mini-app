import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Markdown } from "./markdown"

describe("Markdown", () => {
  it("renders headings and emphasis", () => {
    render(<Markdown>{"# Title\n\n**bold**"}</Markdown>)
    expect(screen.getByTestId("markdown").querySelector("h1")).toHaveTextContent("Title")
    expect(screen.getByTestId("markdown").querySelector("strong")).toHaveTextContent("bold")
  })
})
