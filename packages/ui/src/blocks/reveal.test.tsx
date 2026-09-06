import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Reveal } from "./reveal"

// jsdom has no animation loop for motion to drive, and `useReducedMotion` reads a media
// query jsdom always answers "no". Mocking that one hook is how the reduce-motion branch
// gets tested at all; everything else runs against the real motion component.
const reduced = vi.hoisted(() => ({ current: false }))

vi.mock("motion/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("motion/react")>()
  return { ...mod, useReducedMotion: () => reduced.current }
})

describe("Reveal", () => {
  it("renders its children and marks the host element", () => {
    render(
      <Reveal>
        <span>row</span>
      </Reveal>,
    )
    expect(screen.getByText("row")).toBeInTheDocument()
    expect(document.querySelector("[data-mma-reveal]")).not.toBeNull()
  })

  it("passes className and style through to the animated element", () => {
    render(
      <Reveal className="mt-2" style={{ borderRadius: 8 }}>
        <span>card</span>
      </Reveal>,
    )
    const el = document.querySelector("[data-mma-reveal]") as HTMLElement
    expect(el.className).toContain("mt-2")
    expect(el.style.borderRadius).toBe("8px")
  })

  it("starts hidden and rises, rather than fading in place", () => {
    render(
      <Reveal distance={24}>
        <span>rise</span>
      </Reveal>,
    )
    // motion writes the *initial* state inline; jsdom never runs the tween, so the
    // assertion is about the values it was handed, not about a finished animation.
    const el = document.querySelector("[data-mma-reveal]") as HTMLElement
    expect(el.style.transform).toContain("translateY(24px)")
    expect(el.style.opacity).toBe("0")
  })

  it("settles at the resting state when distance is zero", () => {
    render(
      <Reveal distance={0}>
        <span>fade</span>
      </Reveal>,
    )
    const el = document.querySelector("[data-mma-reveal]") as HTMLElement
    // No travel asked for, none applied — the fade-only variant stays untransformed.
    expect(el.style.transform).toBe("none")
  })

  it("drops travel and stagger when the OS asks to reduce motion", () => {
    reduced.current = true
    try {
      render(
        <Reveal delay={600} distance={40}>
          <span>calm</span>
        </Reveal>,
      )
      const el = document.querySelector("[data-mma-reveal]") as HTMLElement
      // `initial: false` means no start state at all — the element is simply present,
      // and the delay is gone too (a staggered wait with nothing to animate is a freeze).
      expect(el.style.transform).toBe("none")
      expect(el.style.opacity).not.toBe("0")
      expect(screen.getByText("calm")).toBeInTheDocument()
    } finally {
      reduced.current = false
    }
  })
})
