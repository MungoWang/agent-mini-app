import type { AppTab, RuntimePort } from "./ports.js";

export type UiState = {
  tabs: AppTab[];
  activeTabId: string | null;
  themeId: string;
  apps: { id: string; name: string; version: string }[];
};

export type UiCore = {
  getState(): UiState;
  subscribe(fn: (s: UiState) => void): () => void;
  refresh(): Promise<void>;
  openTab(appId: string, title?: string): Promise<AppTab>;
  closeTab(tabId: string): Promise<void>;
  focusTab(tabId: string): Promise<void>;
  setTheme(themeId: string): Promise<void>;
};

export function createUiCore(runtime: RuntimePort): UiCore {
  let state: UiState = {
    tabs: [],
    activeTabId: null,
    themeId: "light",
    apps: [],
  };
  const listeners = new Set<(s: UiState) => void>();

  function emit() {
    for (const fn of listeners) fn(state);
  }

  async function syncFromRuntime() {
    const [tabs, active, themeId, apps] = await Promise.all([
      runtime.listTabs(),
      runtime.getActiveTab(),
      runtime.getTheme(),
      runtime.listApps(),
    ]);
    state = {
      tabs,
      activeTabId: active?.tabId ?? null,
      themeId,
      apps: apps.map((a) => ({ id: a.id, name: a.name, version: a.version })),
    };
    emit();
  }

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh: syncFromRuntime,
    async openTab(appId, title) {
      const tab = await runtime.openTab(appId, { title });
      await syncFromRuntime();
      return tab;
    },
    async closeTab(tabId) {
      await runtime.closeTab(tabId);
      await syncFromRuntime();
    },
    async focusTab(tabId) {
      await runtime.focusTab(tabId);
      await syncFromRuntime();
    },
    async setTheme(themeId) {
      await runtime.setTheme(themeId);
      await syncFromRuntime();
    },
  };
}

/** Headless snapshot for smoke tests / SSR-less hosts */
export function renderTabBarText(state: UiState): string {
  if (!state.tabs.length) return "(no tabs)";
  return state.tabs
    .map((t) => {
      const mark = t.tabId === state.activeTabId ? "*" : " ";
      return `[${mark}${t.title}|${t.appId}]`;
    })
    .join(" ");
}
