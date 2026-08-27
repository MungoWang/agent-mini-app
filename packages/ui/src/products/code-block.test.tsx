import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CodeBlock } from "./code-block"

describe("CodeBlock", () => {
  it("highlights typescript", async () => {
    render(<CodeBlock language="ts" code={"const n: number = 1"} />)
    const root = screen.getByTestId("code-block")
    expect(root).toHaveAttribute("data-language", "ts")
    await waitFor(() => expect(root).toHaveAttribute("data-highlighted", "true"), {
      timeout: 8000,
    })
    expect(root.querySelector(".shiki")).toBeTruthy()
  })
})
