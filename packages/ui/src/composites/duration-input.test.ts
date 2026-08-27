import { describe, expect, it } from "vitest"

import { formatDuration, parseDuration } from "./duration-input"

describe("duration", () => {
  it("parses 2h 30m", () => {
    expect(parseDuration("2h 30m")).toBe(150)
  })
  it("formats minutes", () => {
    expect(formatDuration(150)).toBe("2h 30m")
  })
})
