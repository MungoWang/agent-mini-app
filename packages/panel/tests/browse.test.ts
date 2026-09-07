// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships no IntersectionObserver; Settings.tsx uses one to lazily mount the
// workbench tab. Stub it so the test exercises the real code path.
type ObserverEntry = {
  isIntersecting: boolean;
  intersectionRatio: number;
  target: Element;
};
class IntersectionObserverStub {
  constructor(private readonly cb: (entries: ObserverEntry[]) => void) {}
  observe(el: Element): void {
    // Behave like an element scrolled into view.
    this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el }]);
  }
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof globalThis.IntersectionObserver;

import {
  createMiniAppPanel,
  type PanelInstance,
  resetPanelState,
} from "@monkey-mini-app/panel";

import { createFakePanelHost } from "./fake-panel-host.ts";

const todo = { id: "com.example.todo", name: "Todo", description: "tasks", acronym: "Td" };

let mounted: PanelInstance | null = null;

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted?.unmount();
    });
    mounted = null;
  }
  document.body.innerHTML = "";
  resetPanelState();
});

async function mountFull(locale: "en" | "zh-CN" = "zh-CN"): Promise<{ el: HTMLElement; panel: PanelInstance }> {
  const host = createFakePanelHost({
    locale,
    apps: [todo],
    withHistory: true,
    withStorage: true,
    withConfig: true,
    withPalettes: true,
    withAppTheme: true,
    withDelete: true,
    history: [{ id: "abc1234", message: "init", time: "now", files: [{ path: "ui.tsx", add: 2, del: 1, preview: "+hi" }] }],
    historyDetail: {
      id: "abc1234",
      message: "init",
      time: "now",
      files: [{ path: "ui.tsx", add: 2, del: 1, preview: "+hi" }],
    },
    tables: [
      { name: "kv", size: 4, updatedAt: "t" },
      // A table the host has grown past one rewrite: one file per key, still listed as one table.
      { name: "reads", size: 2 * 1024 * 1024, updatedAt: "t2", keys: 3 },
    ],
    tableValue: { a: 1 },
    palettes: [{ id: "custom-1", label: "Custom One", swatch: "#abc" }],
  });
  const panel = createMiniAppPanel(host);
  mounted = panel;
  const el = document.createElement("div");
  el.id = "mma-host";
  document.body.appendChild(el);
  await act(async () => {
    panel.mount(el);
    panel.actions.openAppTab(todo);
  });
  return { el, panel };
}

describe("Browse / chrome interactions", () => {
  it("opens history, loads a commit, toggles a file preview, and closes", async () => {
    const { el, panel } = await mountFull();
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-history-btn")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.querySelector("#mma-browse")).toBeTruthy();
    expect(el.textContent).toContain("init");
    await act(async () => {
      el.querySelector<HTMLButtonElement>(".mma-bitem")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      el.querySelector<HTMLButtonElement>(".mma-fitem")?.click();
    });
    expect(el.querySelector(".mma-preview")?.textContent).toContain("+hi");
    await act(async () => {
      el.querySelector<HTMLButtonElement>(".mma-browse-head button")?.click();
    });
    await act(async () => {
      panel.actions.toggleBrowse("");
    });
  });

  it("shows table entries and human size", async () => {
    const { el } = await mountFull("en");
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-storage-btn")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const rows = Array.from(el.querySelectorAll(".mma-bitem")).map((n) => n.textContent);
    expect(rows.some((r) => r?.includes("2.0 MB") && r?.includes("3 entries"))).toBe(true);
    expect(rows.some((r) => r?.startsWith("kv") && r?.includes("4 B"))).toBe(true);
  });

  it("shows a storage notice banner with a copyable split prompt", async () => {
    const { el, panel } = await mountFull("en");
    await act(async () => {
      panel.actions.applyStorageNotice({
        appId: "com.example.todo",
        table: "main.storage",
        bytes: 2 * 1024 * 1024,
        keys: 3,
        heavy: [{ key: "reads", bytes: 1_800_000, kind: "list", entries: 100 }],
        prompt: "please split reads into its own table",
      });
      el.querySelector<HTMLButtonElement>("#mma-storage-btn")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.querySelector(".mma-storage-notice")).toBeTruthy();
    expect(el.textContent).toContain("main.storage");
    expect(el.textContent).toContain("reads");
    expect(el.textContent).toMatch(/Copy split prompt|复制拆分提示词/);
  });

  it("opens storage, loads a table, and shows JSON", async () => {
    const { el } = await mountFull();
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-storage-btn")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.textContent).toContain("kv");
    await act(async () => {
      el.querySelector<HTMLButtonElement>(".mma-bitem")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.querySelector(".mma-preview")?.textContent).toContain('"a"');
  });

  it("toggles theme pop, dock, settings, tab close, and delete modal", async () => {
    const { el, panel } = await mountFull();
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-theme-btn")?.click();
    });
    expect(el.querySelector("#mma-theme-pop")?.getAttribute("data-open")).toBe("1");
    await act(async () => {
      el.querySelector<HTMLButtonElement>('[data-mode="dark"]')?.click();
      el.querySelector<HTMLButtonElement>('[data-palette="tokyo"]')?.click();
      el.querySelector<HTMLButtonElement>('[data-palette="custom-1"]')?.click();
      el.querySelector<HTMLButtonElement>('[data-scope="app"]')?.click();
    });
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-dock-host")?.click();
      el.querySelector<HTMLButtonElement>("#mma-settings-btn")?.click();
      el.querySelector<HTMLButtonElement>("#mma-reload")?.click();
      el.querySelector<HTMLElement>(".mma-tab-x")?.click();
    });
    await act(async () => {
      panel.actions.openAppTab(todo);
    });
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-delete")?.click();
    });
    expect(el.querySelector(".mma-modal, #mma-modal, [class*='modal']")).toBeTruthy();
  });

  it("closes theme pop when the scrim is pressed (covers iframe blanks)", async () => {
    const { el } = await mountFull();
    await act(async () => {
      el.querySelector<HTMLButtonElement>("#mma-theme-btn")?.click();
    });
    expect(el.querySelector("#mma-theme-pop")?.getAttribute("data-open")).toBe("1");
    const scrim = el.querySelector<HTMLElement>(".mma-pop-scrim");
    expect(scrim).toBeTruthy();
    await act(async () => {
      scrim?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    expect(el.querySelector("#mma-theme-pop")?.getAttribute("data-open")).toBe("0");
    expect(el.querySelector(".mma-pop-scrim")).toBeNull();
  });
});
