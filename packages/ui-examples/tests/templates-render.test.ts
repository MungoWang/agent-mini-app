// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppRuntime } from "@monkey-mini-app/ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

/**
 * S8b · every shipped facade renders its **first paint**, with no data.
 *
 * `check:templates` type-checks the facades; the smoke sweep registers them and calls their
 * api. Neither one mounts them — so a facade that renders a blank pane on an empty store
 * passes both and only fails in front of a human. This is not hypothetical: `ListDetail`
 * shows its `empty` pane only when `detail` is literally `undefined`, and a facade wrapped
 * the workbook in an always-present `<div>`, which swallowed the file drop target — the one
 * control the app needs before it has anything to show.
 *
 * So: mount each `ui.tsx` with `call` resolving to an empty shape and assert the render
 * produces text at all. The per-facade assertions below then name the affordance that must
 * exist cold.
 */
const EMPTY_RESULTS: Record<string, unknown> = {
  ping: { appId: "com.example", theme: "light", now: Date.now() },
  list: [],
  latest: { items: [], digest: null, at: 0 },
  jobs: { jobs: [] },
  runStatus: { goal: "", status: "idle", steps: [], result: "", startedAt: 0 },
  getSnapshot: { cpu: { model: "test", count: 4 }, memory: { total: 1, used: 1, free: 0, usedPct: 1 } },
  summary: { byStatus: {}, total: 0 },
};

function stubCall(): void {
  g.fetch = async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    const value = body.method ? (EMPTY_RESULTS[body.method] ?? []) : [];
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, value }),
    };
  };
}

const modules = import.meta.glob<{ default: () => unknown }>(
  "../../../skills/monkey-mini-app/templates/*/ui.tsx",
  { eager: false },
);

/**
 * Mount, let the initial `call` settle, and tear down **in the same scope**.
 *
 * An unmount deferred to `afterEach` (or worse, a `document.body.innerHTML = ""` racing an
 * un-awaited `act`) leaks the previous facade's teardown error into the next test's act scope,
 * which then renders nothing and looks like a broken app. Each case owns its container.
 */
async function mountAndProbe(
  Ui: () => unknown,
  appId: string,
  cold?: { text?: string; selector?: string },
): Promise<void> {
  const el = document.createElement("div");
  el.style.width = "1200px";
  document.body.appendChild(el);
  const root = createRoot(el);
  try {
    await act(async () => {
      root.render(createElement(AppRuntime, { appId }, createElement(Ui)));
    });
    // settle the mount-time `call` (and one re-render after it resolves)
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    // Assert while the tree is live: `unmount` empties the container, so returning the node
    // and checking it afterwards would report "rendered nothing" for a working facade.
    const text = el.textContent ?? "";
    expect(text, `${appId} rendered nothing`).not.toBe("");
    if (cold?.text) {
      expect(text, `${appId} is missing its cold-start affordance: ${cold.text}`).toContain(cold.text);
    }
    if (cold?.selector) {
      expect(
        el.querySelector(cold.selector),
        `${appId} is missing its cold-start affordance: ${cold.selector}`,
      ).not.toBeNull();
    }
  } finally {
    await act(async () => {
      root.unmount();
    });
    el.remove();
  }
}

/**
 * What must exist on a cold, empty store. Matched on structure or on markup literals —
 * **not** on kit chrome strings: without a `UiProvider` the kit renders its `en` labels, and
 * asserting a translated label would test the locale, not the app.
 */
const COLD_START: Record<string, { text?: string; selector?: string }> = {
  // the drop target is the whole first screen — `ListDetail` hides it the moment `detail`
  // is a present element instead of `undefined`
  sheets: { selector: "input[type=file]" },
  chores: { text: "chores" },
  watch: { text: "值班屏" },
};

describe("skill facades render on an empty store", () => {
  beforeEach(() => {
    stubCall();
  });

  afterEach(() => {
    delete (g as Record<string, unknown>).fetch;
  });

  for (const [path, load] of Object.entries(modules)) {
    const name = /templates\/([^/]+)\/ui\.tsx$/.exec(path)?.[1] ?? path;

    it(name, async () => {
      const mod = (await load()) as { default: () => unknown };
      const Ui = mod.default;
      expect(typeof Ui, `${name}/ui.tsx has no default export`).toBe("function");

      await mountAndProbe(Ui, `com.example.${name}`, COLD_START[name]);
    });
  }
});
