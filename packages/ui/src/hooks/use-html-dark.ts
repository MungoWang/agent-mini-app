"use client"

import { useEffect, useState } from "react"

/** True when the iframe/host document is in dark mode (class, data-theme, or --background). */
export function htmlIsDark(el?: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false
  const root = el ?? document.documentElement
  if (root.classList.contains("dark")) return true
  if (root.classList.contains("light")) return false
  const theme = root.getAttribute("data-theme")
  if (theme === "dark") return true
  if (theme === "light") return false
  try {
    const bg =
      root.style.getPropertyValue("--background").trim() ||
      getComputedStyle(root).getPropertyValue("--background").trim()
    const oklch = bg.match(/oklch\(\s*([0-9.]+)/i)
    if (oklch) return Number(oklch[1]) < 0.5
  } catch {
    /* jsdom */
  }
  return false
}

export function useHtmlDark(): boolean {
  const [dark, setDark] = useState(() => htmlIsDark())
  useEffect(() => {
    const el = document.documentElement
    const read = () => setDark(htmlIsDark(el))
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ["class", "data-theme", "style"] })
    return () => obs.disconnect()
  }, [])
  return dark
}
