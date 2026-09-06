import { expect, test } from "@playwright/test"

/**
 * Kit `Reveal` must be driven by the platform motion build, in a real browser.
 *
 * Why this needs a browser at all: `Reveal` hands values to motion, and motion writes them
 * as inline styles on each frame. jsdom has no animation loop, so the kit's own unit test
 * can only assert the values it was *given* (`reveal.test.tsx`) — never that anything was
 * actually driven. A regression that leaves the element sitting at `opacity: 0` forever
 * (a second motion/React pair, an externalised module that failed to resolve) is invisible
 * without real style computation.
 *
 * This is the standalone demo host, which renders examples directly through Vite — there are
 * no `/mma/*` requests here by design. The iframe module graph (one React, one motion) is
 * pinned in `packages/host/tests/http-gateway.test.ts`, on the bytes the host actually
 * serves.
 *
 * Gotcha, learned the expensive way: `@monkey-mini-app/ui` resolves through the package's
 * `exports`, i.e. **`packages/ui/dist`**, not `src` (only `globals.css` is aliased to
 * source). Editing a component and re-running this spec tests the *previous* build. Run
 * `pnpm build:ui` first — and if a canary here appears to pass, that is the first thing to
 * suspect, not the assertion.
 *
 * Run with: pnpm --filter demo-host test:e2e
 */

/** Style sections all open with kit `Reveal`. */
const SECTIONS = ["style-glass", "style-desk", "style-dark"] as const

function revealStyles() {
  return [...document.querySelectorAll<HTMLElement>("[data-mma-reveal]")].map((el) => ({
    transform: el.style.transform,
    opacity: el.style.opacity,
  }))
}

for (const section of SECTIONS) {
  test(`${section}: reveals are motion-driven and settle visible`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto("/")
    await page.getByTestId(`nav-${section}`).click()
    await page.locator("[data-mma-reveal]").first().waitFor({ state: "attached", timeout: 20_000 })

    // Mid-flight: at least one element must carry motion-written inline values. The old
    // hand-rolled version used a CSS class and leaves `style` empty — verified by canary
    // (swapping the component back to `animate-in` turns all three tests red).
    const mid = await page.evaluate(`(${revealStyles.toString()})()`)
    expect(mid.length).toBeGreaterThan(0)
    expect(mid.some((s) => s.transform !== "" || s.opacity !== "")).toBe(true)

    // At rest: opacity 1 everywhere. A broken runtime strands reveals at 0 — the page
    // renders, tests that only look for nodes still pass, and the user sees a blank panel.
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("[data-mma-reveal]")].every(
              (el) => getComputedStyle(el).opacity === "1",
            ),
          ),
        { timeout: 15_000 },
      )
      .toBe(true)
  })
}

// Reduce-motion is deliberately NOT covered here. An earlier version of this spec asserted
// it and passed with the `useReducedMotion()` call deleted from the component: by the time
// Playwright can observe the nodes, a 320ms entrance has already settled, so "opacity is 1"
// is true in both modes and proves nothing. `reveal.test.tsx` asserts the initial values
// motion is handed instead, which was canaried (removing the reduce-motion branch turns that
// test red).
