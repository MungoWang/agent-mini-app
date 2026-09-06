import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CodeBlock } from "./code-block"

/**
 * shiki arrives from `https://esm.sh/shiki@…` at runtime (see the CDN note in
 * `code-block.tsx` and hard constraint #12 in AGENTS.md), so it is deliberately not a
 * dependency and not bundled. That has a testing consequence worth stating plainly:
 * **highlighting cannot be asserted here.** This project has no network, the dynamic import
 * rejects, and the component takes its documented degrade path.
 *
 * What this does pin is the part that matters offline and is easy to get wrong: a failed
 * CDN must still show the code. A `CodeBlock` that renders an empty box when esm.sh is
 * unreachable is a data-loss bug wearing a styling costume. Actual highlight output is
 * covered in a real browser, not by a unit test reaching for the network.
 */
describe("CodeBlock", () => {
  it("keeps the code visible when the highlight CDN is unreachable", async () => {
    const code = "const n: number = 1"
    render(<CodeBlock language="ts" code={code} />)
    const root = screen.getByTestId("code-block")
    expect(root).toHaveAttribute("data-language", "ts")

    // The CDN import settles one way or the other; wait for that, not for success.
    await waitFor(() => expect(root).toHaveAttribute("data-highlighted"))

    // No network here, so the degrade branch — plain <pre><code> — must carry the text.
    const pre = root.querySelector("pre > code")
    expect(pre).toBeTruthy()
    expect(pre?.textContent).toBe(code)
  })

  it("reports the language it was given without depending on shiki", () => {
    for (const lang of ["json", "bash", "ts"]) {
      const { unmount } = render(<CodeBlock language={lang} code="x" />)
      expect(screen.getByTestId("code-block")).toHaveAttribute("data-language", lang)
      unmount()
    }
  })
})
