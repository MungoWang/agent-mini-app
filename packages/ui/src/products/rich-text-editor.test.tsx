import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RichTextEditor } from "./rich-text-editor"

describe("RichTextEditor", () => {
  it("renders toolbar", async () => {
    render(<RichTextEditor value="<p>hello</p>" />)
    expect(await screen.findByTestId("rich-text-editor")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Bold" })).toBeInTheDocument()
  })
})
