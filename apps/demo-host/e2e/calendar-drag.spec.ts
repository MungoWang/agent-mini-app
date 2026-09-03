import { expect, test } from "@playwright/test"

/**
 * Drag-to-create in the week view must map pixels to time exactly like the day
 * view. The week grid used to remount on every drag state change (the motion shim
 * handed out a new component type per render), which left the hook measuring a
 * detached node — an all-zero DOMRect — so a few pixels became hours.
 * Run with: pnpm --filter demo-host test:e2e
 */
const HOUR_PX = 96

async function dragOneHour(page: any, cal: any, colIndex: number) {
  const col = cal.locator('[data-testid="calendar-day-column"]').nth(colIndex)
  const g = await col.evaluate((c: HTMLElement) => {
    const r = c.getBoundingClientRect()
    return { top: Math.round(r.top), left: Math.round(r.left) }
  })
  const x = g.left + 18
  await page.mouse.move(x, g.top + 100)
  await page.mouse.down()
  for (const dy of [16, 32, 48, 64, 80, HOUR_PX]) await page.mouse.move(x, g.top + 100 + dy)
  const overlay = col.locator('[data-testid="calendar-selection-overlay"]')
  await expect(overlay).toBeVisible()
  expect(Math.round(await overlay.evaluate((o: any) => parseFloat(o.style.height)))).toBe(HOUR_PX)
  await page.mouse.up()
  const dlg = await page.locator('[role="dialog"]').first().innerText()
  const mins = (dlg.match(/\d{1,2}:\d{2}\s*(AM|PM)/g) || []).slice(0, 2).map((s: string) => {
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/)!
    const h = parseInt(m[1], 10) % 12 + (m[3] === "PM" ? 12 : 0)
    return h * 60 + parseInt(m[2], 10)
  })
  expect(mins).toHaveLength(2)
  expect(mins[1] - mins[0]).toBe(60)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
}

for (const view of ["week", "day"] as const) {
  test(`${view} view: a ${HOUR_PX}px drag creates a 60 minute event`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto("/")
    await page.getByRole("button", { name: "Products" }).click()
    const cal = page.locator('[data-testid="event-calendar"]').first()
    await cal.waitFor({ state: "attached", timeout: 20_000 })
    await cal.scrollIntoViewIfNeeded()
    await cal.locator(`[data-testid="calendar-view-${view}"]`).click()
    await page.waitForTimeout(1200) // entry animations settle
    await dragOneHour(page, cal, view === "week" ? 1 : 0)
  })
}
