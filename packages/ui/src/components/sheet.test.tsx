import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Sheet, SheetContent } from "./sheet"

/** These primitives mark themselves with `data-slot`; there is no `data-testid` on them. */
const panel = () => document.querySelector('[data-slot="sheet-content"]') as HTMLElement

describe("SheetContent", () => {
  it("sizes the panel through width, which the built-in sm cap cannot beat", () => {
    render(
      <Sheet open>
        <SheetContent width={720}>panel</SheetContent>
      </Sheet>,
    )

    // Inline, not a class: `data-[side=right]:sm:max-w-sm` outranks a `max-w-*` utility.
    expect(panel().style.maxWidth).toBe("720px")
    expect(panel().className).toContain("data-[side=right]:sm:max-w-sm")
  })

  it("accepts a CSS length and keeps className for everything else", () => {
    render(
      <Sheet open>
        <SheetContent width="40rem" className="gap-6">
          panel
        </SheetContent>
      </Sheet>,
    )

    expect(panel().style.maxWidth).toBe("40rem")
    expect(panel().className).toContain("gap-6")
  })

  it("leaves the default cap alone when no width is given", () => {
    render(
      <Sheet open>
        <SheetContent>panel</SheetContent>
      </Sheet>,
    )

    expect(panel().style.maxWidth).toBe("")
  })
})
