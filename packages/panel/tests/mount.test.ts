// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createMiniAppPanel, getPanelState, type PanelInstance,resetPanelState } from "@monkey-mini-app/panel";

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

function hostEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "mma-host";
  document.body.appendChild(el);
  return el;
}

describe("createMiniAppPanel mount smoke", () => {
  it("mounts chrome, fetchApps renders cards, open/close call the host", async () => {
    const host = createFakePanelHost({ apps: [todo] });
    const panel = createMiniAppPanel(host);
    mounted = panel;
    const el = hostEl();

    await act(async () => {
      panel.mount(el);
    });
    expect(el.querySelector(".mma-chrome")).toBeTruthy();
    expect(el.querySelector("#mma-tabs")).toBeTruthy();
    expect(document.querySelector('style[data-plugin-css="panel"]')).toBeTruthy();

    await act(async () => {
      panel.actions.fetchApps();
    });
    expect(getPanelState().apps).toHaveLength(1);
    expect(el.textContent).toContain("Todo");
    expect(el.textContent).toContain("小程序");

    panel.open();
    panel.close();
    expect(host.calls.openPanel).toBe(1);
    expect(host.calls.closePanel).toBe(1);

    await act(async () => {
      panel.unmount();
    });
    mounted = null;
    expect(el.querySelector(".mma-chrome")).toBeNull();
  });

  it("hides history / storage / settings / delete without those host capabilities", async () => {
    const host = createFakePanelHost({ apps: [todo] });
    const panel = createMiniAppPanel(host);
    mounted = panel;
    const el = hostEl();
    await act(async () => {
      panel.mount(el);
      panel.actions.openAppTab(todo);
    });
    expect(el.querySelector("#mma-history-btn")).toBeNull();
    expect(el.querySelector("#mma-storage-btn")).toBeNull();
    expect(el.querySelector("#mma-settings-btn")).toBeNull();
    expect(el.querySelector("#mma-delete")).toBeNull();
    expect(el.querySelector("#mma-theme-btn")).toBeTruthy();
  });

  it("shows optional chrome when the host implements the capabilities", async () => {
    const host = createFakePanelHost({
      apps: [todo],
      withHistory: true,
      withStorage: true,
      withConfig: true,
      withDelete: true,
    });
    const panel = createMiniAppPanel(host);
    mounted = panel;
    const el = hostEl();
    await act(async () => {
      panel.mount(el);
      panel.actions.openAppTab(todo);
    });
    expect(el.querySelector("#mma-history-btn")).toBeTruthy();
    expect(el.querySelector("#mma-storage-btn")).toBeTruthy();
    expect(el.querySelector("#mma-settings-btn")).toBeTruthy();
    expect(el.querySelector("#mma-delete")).toBeTruthy();
  });

  it("uses options.locale for chrome copy", async () => {
    const host = createFakePanelHost({ apps: [todo], locale: "zh-CN" });
    const panel = createMiniAppPanel(host, { locale: "en" });
    mounted = panel;
    const el = hostEl();
    await act(async () => {
      panel.mount(el);
      panel.actions.fetchApps();
    });
    expect(el.textContent).toContain("Mini apps");
    expect(el.textContent).toContain("All");
    expect(el.textContent).not.toContain("小程序");
  });
});
