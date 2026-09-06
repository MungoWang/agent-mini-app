import { expect, test } from "@playwright/test"

/**
 * The one thing only a browser can prove about `ListDetail`: at a fixed height each pane is its
 * own scroll container, scrolling one leaves the other and the toolbar alone, and the content
 * never grows the box. The class contract behind it (`min-h-0` in the flex chain) is guarded in
 * `packages/ui/src/blocks/list-detail.test.tsx`, which is the layer that can see those classes.
 *
 * Run with: pnpm --filter demo-host test:e2e   (build the kit first — the demo host resolves
 * `@monkey-mini-app/ui` to `packages/ui/dist`, so `src` changes need `pnpm build:ui`)
 */
const scrollTop = (loc: any) => loc.evaluate((el: HTMLElement) => el.scrollTop)
const overflow = (loc: any) =>
  loc.evaluate((el: HTMLElement) => el.scrollHeight - el.clientHeight)

test("ListDetail: both panes scroll independently, toolbar stays put", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/")
  await page.getByTestId("nav-blocks").click()

  const root = page.getByTestId("list-detail").first()
  await root.scrollIntoViewIfNeeded()
  await expect(root).toBeVisible()

  // Nothing is selected yet: the record pane holds the placeholder and must not scroll.
  const list = root.getByTestId("list-detail-list")
  const detail = root.getByTestId("list-detail-detail")
  const toolbar = root.getByTestId("list-detail-toolbar")
  const rootBefore = await root.boundingBox()
  expect(rootBefore).not.toBeNull()

  await root.getByText("OPS-1040").click()
  const toolbarTop = async () => (await toolbar.boundingBox())?.y
  const y0 = await toolbarTop()

  // 40 rows on one side, a 30-line activity log on the other: both really overflow.
  expect(await overflow(list)).toBeGreaterThan(40)
  expect(await overflow(detail)).toBeGreaterThan(40)
  // The preset stays inside the height the app gave it; content may not push it taller.
  expect((await root.boundingBox())?.height).toBeLessThanOrEqual(421)

  await list.evaluate((el: HTMLElement) => {
    el.scrollTop = 120
  })
  expect(await scrollTop(list)).toBe(120)
  expect(await scrollTop(detail)).toBe(0)

  await detail.evaluate((el: HTMLElement) => {
    el.scrollTop = 80
  })
  expect(await scrollTop(detail)).toBe(80)
  expect(await scrollTop(list)).toBe(120)

  // Scrolling inside the panes moved nothing outside them.
  expect(await toolbarTop()).toBe(y0)
  const after = await root.boundingBox()
  expect(after?.y).toBe(rootBefore?.y)
})
