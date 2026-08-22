import { describe, it, expect } from "vitest";
import { createUiCore, renderTabBarText } from "./index.js";
import type { RuntimePort, AppTab } from "@monkey-mini-app/host-port";

function mockRt(): RuntimePort {
  const tabs: AppTab[] = [];
  let active: string | null = null;
  let themeId = "light";
  return {
    listApps: async () => [
      { id: "com.ex.a", name: "Alpha", version: "1", enabled: true },
      { id: "com.ex.b", name: "Beta", version: "1", enabled: true },
    ],
    getApp: async () => null,
    mount: async () => {},
    unmount: async () => {},
    listThemes: async () => [],
    getTheme: async () => themeId,
    setTheme: async (id) => {
      themeId = id;
    },
    registerAppFromFiles: async () => {},
    removeApp: async () => {},
    listCapabilities: async () => [],
    historyCommit: async () => ({ commitId: "x" }),
    historyList: async () => ({ head: "x", nodes: [] }),
    historyRevert: async () => ({ commitId: "y" }),
    historyResetTo: async () => ({}),
    openTab: async (appId, opts) => {
      const tab: AppTab = {
        tabId: `t_${tabs.length + 1}`,
        appId,
        title: opts?.title ?? appId,
        createdAt: new Date().toISOString(),
      };
      tabs.push(tab);
      active = tab.tabId;
      return tab;
    },
    closeTab: async (id) => {
      const i = tabs.findIndex((t) => t.tabId === id);
      if (i >= 0) tabs.splice(i, 1);
      active = tabs.at(-1)?.tabId ?? null;
    },
    listTabs: async () => [...tabs],
    focusTab: async (id) => {
      active = id;
    },
    getActiveTab: async () => tabs.find((t) => t.tabId === active) ?? null,
  };
}

describe("ui-core multi-tab", () => {
  it("open two tabs and switch focus", async () => {
    const ui = createUiCore(mockRt());
    await ui.openTab("com.ex.a", "Alpha");
    await ui.openTab("com.ex.b", "Beta");
    let s = ui.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.activeTabId).toBe("t_2");
    await ui.focusTab("t_1");
    s = ui.getState();
    expect(s.activeTabId).toBe("t_1");
    const bar = renderTabBarText(s);
    expect(bar).toContain("*Alpha");
    expect(bar).toContain(" Beta");
  });

  it("subscribe receives updates", async () => {
    const ui = createUiCore(mockRt());
    const seen: number[] = [];
    ui.subscribe((s) => seen.push(s.tabs.length));
    await ui.openTab("com.ex.a");
    expect(seen.at(-1)).toBe(1);
  });
});
