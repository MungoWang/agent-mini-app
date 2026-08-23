import { describe, it, expect } from "vitest";
import { listAgentTools, createAgentHandlers } from "./index.js";
import type { RuntimePort, AppTab } from "@monkey-mini-app/host-port";

function mockRuntime(overrides: Partial<RuntimePort> = {}): RuntimePort {
  const tabs: AppTab[] = [];
  let active: string | null = null;
  return {
    listApps: async () => [{ id: "com.ex.a", name: "A", version: "1", enabled: true }],
    getApp: async (id) =>
      id === "com.ex.a"
        ? { id, name: "A", version: "1", enabled: true, permissions: ["storage"] }
        : null,
    mount: async () => {},
    unmount: async () => {},
    listThemes: async () => [{ id: "light", label: "Light" }],
    getTheme: async () => "light",
    setTheme: async () => {},
    registerAppFromFiles: async () => {},
    removeApp: async () => {},
    listCapabilities: async () => [],
    historyCommit: async () => ({ commitId: "c1" }),
    historyList: async () => ({ head: "c1", nodes: [] }),
    historyRevert: async () => ({ commitId: "c2" }),
    historyResetTo: async () => ({ backupRef: "backup/x" }),
    openTab: async (appId, opts) => {
      const tab = {
        tabId: "tab_1",
        appId,
        title: opts?.title ?? "A",
        createdAt: new Date().toISOString(),
      };
      tabs.push(tab);
      active = tab.tabId;
      return tab;
    },
    closeTab: async (tabId) => {
      const i = tabs.findIndex((t) => t.tabId === tabId);
      if (i >= 0) tabs.splice(i, 1);
      active = tabs[0]?.tabId ?? null;
    },
    listTabs: async () => [...tabs],
    focusTab: async (tabId) => {
      active = tabId;
    },
    getActiveTab: async () => tabs.find((t) => t.tabId === active) ?? null,
    ...overrides,
  };
}

describe("agent-core", () => {
  it("lists stable tool names", () => {
    const names = listAgentTools().map((t) => t.name);
    expect(names).toContain("mini_app_open");
    expect(names).toContain("mini_app_register");
    expect(names).toContain("mini_app_history_list");
    expect(names).toContain("mini_app_call");
  });

  it("open/list/focus/close tabs via handlers", async () => {
    const runtime = mockRuntime();
    const h = createAgentHandlers({
      runtime,
      resolveAppDir: (id) => `/r/apps/${id}`,
      runtimeRoot: "/r",
    });
    const opened = (await h.mini_app_open({ appId: "com.ex.a" })) as { tab: { tabId: string } };
    expect(opened.tab.tabId).toBe("tab_1");
    expect((await h.mini_app_list_tabs() as { tabs: unknown[] }).tabs).toHaveLength(1);
    await h.mini_app_focus({ tabId: opened.tab.tabId });
    await h.mini_app_close_tab({ tabId: opened.tab.tabId });
    expect((await h.mini_app_list_tabs() as { tabs: unknown[] }).tabs).toHaveLength(0);
  });

  it("validate rejects bad appId", async () => {
    const h = createAgentHandlers({
      runtime: mockRuntime(),
      resolveAppDir: (id) => id,
      runtimeRoot: "/r",
    });
    const r = await h.mini_app_validate({ appId: "NotValid" });
    expect(r.ok).toBe(false);
  });
});
