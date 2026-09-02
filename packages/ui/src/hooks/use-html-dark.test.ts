/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest"

import { htmlIsDark } from "./use-html-dark"

describe("htmlIsDark", () => {
  afterEach(() => {
    document.documentElement.className = ""
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.style.removeProperty("--background")
  })

  it("follows the dark class", () => {
    document.documentElement.classList.add("dark")
    expect(htmlIsDark()).toBe(true)
  })

  it("follows data-theme", () => {
    document.documentElement.setAttribute("data-theme", "dark")
    expect(htmlIsDark()).toBe(true)
  })

  it("treats a dark --background as dark", () => {
    document.documentElement.style.setProperty("--background", "oklch(0.22 0.02 250)")
    expect(htmlIsDark()).toBe(true)
  })
})
