import { describe, expect, it } from "vitest"

import { motion } from "./motion"

describe("motion shim", () => {
  it("returns one stable component per tag", () => {
    // A fresh component type per access makes React unmount the whole subtree on
    // every render: refs held across renders (pointer capture, drag geometry)
    // then point at detached nodes.
    expect(motion.div).toBe(motion.div)
    expect(motion.span).toBe(motion.span)
    expect(motion.div).not.toBe(motion.span)
  })

  it("returns one stable component per wrapped component", () => {
    const Comp = () => null
    expect(motion.create(Comp)).toBe(motion.create(Comp))
  })
})
