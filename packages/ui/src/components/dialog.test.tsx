import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Dialog, DialogContent } from "./dialog"

/** These primitives mark themselves with `data-slot`; there is no `data-testid` on them. */
const box = () => document.querySelector('[data-slot="dialog-content"]') as HTMLElement

describe("DialogContent", () => {
  it("sizes the dialog through width instead of fighting sm:max-w-sm", () => {
    render(
      <Dialog open>
        <DialogContent width={640}>form</DialogContent>
      </Dialog>,
    )

    expect(box().style.maxWidth).toBe("640px")
    expect(box().className).toContain("sm:max-w-sm")
  })

  it("does not touch maxWidth when the caller passes no width", () => {
    render(
      <Dialog open>
        <DialogContent>form</DialogContent>
      </Dialog>,
    )

    expect(box().style.maxWidth).toBe("")
  })
})
