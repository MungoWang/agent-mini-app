import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MarkdownEditor } from "./markdown-editor"

describe("MarkdownEditor", () => {
  it("splits edit and live preview", () => {
    render(<MarkdownEditor value="# Hello" mode="split" />)
    expect(screen.getByTestId("markdown-editor")).toBeInTheDocument()
    expect(screen.getByTestId("code-editor")).toBeInTheDocument()
    expect(screen.getByTestId("markdown-preview").querySelector("h1")).toHaveTextContent("Hello")
  })

  it("switches to preview only", async () => {
    const onModeChange = vi.fn()
    const user = userEvent.setup()
    render(<MarkdownEditor value="# Hello" mode="split" onModeChange={onModeChange} />)
    await user.click(screen.getByTestId("markdown-mode-preview"))
    expect(onModeChange).toHaveBeenCalledWith("preview")
  })
})
