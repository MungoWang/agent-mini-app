// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships neither observer; cmdk, Scrollspy and react-resizable-panels all
// construct one on mount. No-op stubs — this test asks "does it render", not
// "does intersection tracking work".
class ObserverStub {
  constructor(private readonly cb?: (entries: unknown[]) => void) {}
  observe(el?: Element): void {
    void el;
    this.cb?.([]);
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return [];
  }
}
const g = globalThis as unknown as Record<string, unknown>;
g.IntersectionObserver ??= ObserverStub;
g.ResizeObserver ??= ObserverStub;
// cmdk scrolls its active item into view
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

/**
 * S8 · every shared example actually renders.
 *
 * `tsc` and the host's compile step are both happy with a hook at module scope or a
 * dangling import — the failure only surfaces in the browser ("Cannot read properties of
 * null (reading 'useState')"), which is exactly how a broken generated example once
 * reached the kit fixture. So mount each example instead of trusting the type checker.
 *
 * The CDN-backed editors swallow their own fetch failure, so jsdom is enough here.
 */
const modules = import.meta.glob<{ default: () => unknown }>("../src/components/**/*.tsx", {
  eager: false,
});

const names = Object.keys(modules).sort();

describe("S8 · shared examples render", () => {
  it("finds the examples to check", () => {
    expect(names.length).toBeGreaterThan(50);
  });

  for (const rel of names) {
    it(`renders ${rel.replace("../src/components/", "")}`, async () => {
      const mod = await modules[rel]!();
      expect(typeof mod.default, `${rel} must default-export a component`).toBe("function");

      const el = document.createElement("div");
      document.body.appendChild(el);
      const root = createRoot(el);
      try {
        act(() => {
          root.render(createElement(mod.default));
        });
        expect(el.childElementCount, `${rel} rendered nothing`).toBeGreaterThan(0);
        act(() => root.unmount());
      } finally {
        el.remove();
      }
    });
  }
});
