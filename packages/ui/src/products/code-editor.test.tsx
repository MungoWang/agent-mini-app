import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CodeEditor } from "./code-editor"

describe("CodeEditor", () => {
  it("renders", () => {
    render(<CodeEditor value={"const n = 1"} language="ts" />)
    expect(screen.getByTestId("code-editor")).toBeInTheDocument()
  })
})
