import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RichTextEditor } from "./rich-text-editor"

describe("RichTextEditor", () => {
  it("renders toolbar and editable surface", () => {
    render(<RichTextEditor value="<p>hello</p>" />)
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("calls onChange when typing", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RichTextEditor value="<p></p>" onChange={onChange} />)
    const box = screen.getByRole("textbox")
    await user.click(box)
    await user.keyboard("hi")
    expect(onChange).toHaveBeenCalled()
  })
})
