// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { installFootCss } from "../src/client/css.ts";
import {
  armDockAnim,
  clearVisTimer,
  createLayoutState,
  followSidebar,
  hostLeftPx,
  layoutLocked,
  lockLayout,
  markFooter,
  setDockPad,
  startRailWatch,
  startSidebarSync,
  syncHostToSidebar,
} from "../src/client/layout.ts";
import { dshIsDark, readStoredMode, readStoredPalette } from "../src/client/theme.ts";
import { css, escapeHtml, fmtTime, isRecord, luminanceOf } from "../src/client/utils.ts";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

class FakeRO {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe("layout / css / theme helpers", () => {
  it("installs footer CSS once and computes host left from sidebar rects", () => {
    installFootCss();
    installFootCss();
    expect(document.querySelectorAll("#mma-foot-css")).toHaveLength(1);

    const aside = document.createElement("aside");
    aside.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 72, height: 800, right: 72, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(aside);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    expect(hostLeftPx(document.body, 800)).toBe(72);
    const far = document.createElement("nav");
    far.getBoundingClientRect = () =>
      ({ top: 80, left: 0, width: 72, height: 800, right: 72, bottom: 880, x: 0, y: 80, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(far);
    expect(hostLeftPx(document.body, 800)).toBe(72);
  });

  it("pads dock, animates, locks, and syncs the host element", () => {
    vi.stubGlobal("ResizeObserver", FakeRO);
    const host = document.createElement("div");
    host.id = "mma-host";
    document.body.appendChild(host);
    const state = createLayoutState("fill");
    setDockPad(true, 1000);
    expect(document.documentElement.classList.contains("mma-dock-side")).toBe(true);
    armDockAnim(state);
    expect(host.classList.contains("mma-anim-dock")).toBe(true);
    lockLayout(state);
    expect(layoutLocked(state)).toBe(true);
    state.closing = false;
    state.layoutLockUntil = 0;
    expect(layoutLocked(state)).toBe(false);
    state.visible = true;
    state.dock = "side";
    syncHostToSidebar(state, true);
    expect(host.getAttribute("data-dock")).toBe("side");
    state.dock = "fill";
    syncHostToSidebar(state, false);
    expect(host.style.boxShadow).toBe("none");
    state.visTimer = setTimeout(() => undefined, 9999);
    clearVisTimer(state);
    expect(state.visTimer).toBe(0);
    const btn = document.createElement("button");
    btn.setAttribute("data-mma-open", "1");
    document.body.appendChild(btn);
    markFooter(true);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    followSidebar(state, 0);
    startSidebarSync(state, () => undefined);
    startSidebarSync(state, () => undefined);
    vi.stubGlobal("setInterval", () => 0);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }));
    startRailWatch(state, () => undefined);
    startRailWatch(state, () => undefined);
  });

  it("reads stored theme and probes darkness", () => {
    expect(readStoredMode(null)).toBeNull();
    expect(readStoredPalette(null)).toBeNull();
    const storage = {
      getItem: (k: string) => (k === "mma-theme-mode" ? "dark" : k === "mma-palette" ? "tokyo" : null),
    };
    expect(readStoredMode(storage)).toBe("dark");
    expect(readStoredPalette(storage)).toBe("tokyo");
    expect(readStoredMode({ getItem: () => "nope" })).toBeNull();
    expect(readStoredPalette({ getItem: () => "" })).toBeNull();
    expect(dshIsDark()).toBe(false);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("'")).toBe("&#39;");
    expect(escapeHtml(null)).toBe("");
    expect(fmtTime("")).toBe("");
    expect(fmtTime("2026-08-29T01:02:00Z")).toMatch(/2026-08-29/);
    expect(luminanceOf("rgba(0,0,0,0.1)")).toBeNull();
    const el = document.createElement("div");
    css(el, { color: "red" });
    expect(el.style.color).toBe("red");
  });
});
