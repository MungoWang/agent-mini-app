import { afterEach, describe, expect, it } from "vitest";

import {
  capabilitiesOf,
  clampPaletteId,
  createPanelActions,
  createPanelI18n,
  defaultHideThemePop,
  getPanelState,
  resetPanelState,
  setPanelState,
} from "@monkey-mini-app/panel";

import { createFakePanelHost } from "./fake-panel-host.ts";

const todo = { id: "com.example.todo", name: "Todo", description: "tasks" };

afterEach(() => {
  resetPanelState();
});

function actionsFor(host = createFakePanelHost({ apps: [todo] }), locale: "zh-CN" | "en" = "zh-CN") {
  resetPanelState();
  return { host, actions: createPanelActions(host, () => null, createPanelI18n(locale)) };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createPanelActions + FakePanelHost", () => {
  it("fetchApps loads host apps into the store", async () => {
    const { host, actions } = actionsFor();
    actions.fetchApps();
    expect(getPanelState().loading).toBe(true);
    await flush();
    expect(host.calls.fetchApps).toBe(1);
    expect(getPanelState().loading).toBe(false);
    expect(getPanelState().apps).toEqual([todo]);
  });

  it("fetchApps records host errors", async () => {
    const { actions } = actionsFor(createFakePanelHost({ fetchError: new Error("boom") }));
    actions.fetchApps();
    await flush();
    expect(getPanelState().error).toBe("boom");
    expect(getPanelState().loading).toBe(false);
  });

  it("openAppTab / closeTab / switchTab drive frame mount and unmount", () => {
    const { host, actions } = actionsFor();
    actions.openAppTab(todo);
    expect(getPanelState().active).toBe("app:com.example.todo");
    expect(host.calls.mount).toEqual(["com.example.todo"]);
    actions.switchTab("all");
    expect(getPanelState().active).toBe("all");
    actions.switchTab("app:com.example.todo");
    expect(host.calls.mount).toEqual(["com.example.todo", "com.example.todo"]);
    actions.closeTab("app:com.example.todo");
    expect(host.calls.unmount).toEqual(["com.example.todo"]);
    expect(getPanelState().active).toBe("all");
    expect(getPanelState().tabs.some((t) => t.id === "app:com.example.todo")).toBe(false);
  });

  it("does not close the all tab", () => {
    const { actions } = actionsFor();
    actions.closeTab("all");
    expect(getPanelState().tabs).toEqual([{ id: "all", title: "全部", kind: "all" }]);
  });

  it("reloadActive and closeDashboard call the host", () => {
    const { host, actions } = actionsFor();
    actions.openAppTab(todo);
    actions.reloadActive();
    expect(host.calls.reload).toEqual(["com.example.todo"]);
    actions.closeDashboard();
    expect(host.calls.closePanel).toBe(1);
  });

  it("setAppearance persists global theme on the host", () => {
    const { host, actions } = actionsFor();
    actions.setAppearance({ theme: "dark", palette: "tokyo" }, "global");
    expect(getPanelState().theme).toBe("dark");
    expect(getPanelState().palette).toBe("tokyo");
    expect(host.calls.persistTheme).toEqual([{ theme: "dark", palette: "tokyo" }]);
    expect(host.calls.syncEnv).toBe(1);
  });

  it("setAppearance with app scope saves per-app theme and syncs frames", async () => {
    const host = createFakePanelHost({ apps: [todo], withAppTheme: true });
    const { actions } = actionsFor(host);
    actions.openAppTab(todo);
    actions.setAppearance({ theme: "dark" }, "app");
    await flush();
    expect(host.calls.appThemeSave).toEqual([
      { appId: "com.example.todo", theme: "dark", palette: "default" },
    ]);
    expect(getPanelState().apps[0]?.theme).toEqual({ theme: "dark", palette: "default" });
    expect(host.calls.syncEnv).toBe(1);
    actions.clearAppTheme();
    await flush();
    expect(host.calls.appThemeClear).toEqual(["com.example.todo"]);
    expect(getPanelState().apps[0]?.theme).toBeNull();
    expect(host.calls.syncEnv).toBe(2);
  });

  it("toggleSettings loads config; saveHostConfig writes i18n saved message", async () => {
    const host = createFakePanelHost({
      apps: [todo],
      withConfig: true,
      config: { hostPort: "9", locale: "en" },
    });
    const { actions } = actionsFor(host);
    actions.toggleSettings(true);
    await flush();
    expect(host.calls.configLoad).toBe(1);
    expect(getPanelState().cfg).toEqual({ hostPort: "9", locale: "en" });
    actions.saveHostConfig({ hostPort: "10" });
    await flush();
    expect(host.calls.configSave).toEqual([{ hostPort: "10" }]);
    expect(getPanelState().cfgMsg).toBe("已保存");
  });

  it("toggleBrowse lists history when the host has history", async () => {
    const host = createFakePanelHost({
      apps: [todo],
      withHistory: true,
      history: [{ id: "abc", message: "init", time: "t" }],
    });
    const { actions } = actionsFor(host);
    actions.openAppTab(todo);
    actions.toggleBrowse("history");
    await flush();
    expect(host.calls.historyList).toEqual(["com.example.todo"]);
    expect(getPanelState().browseOpen).toBe(true);
    expect(getPanelState().browseList).toHaveLength(1);
    actions.loadCommitDetail("abc");
    await flush();
    expect(host.calls.historyDetail).toEqual([{ appId: "com.example.todo", id: "abc" }]);
  });

  it("toggleBrowse does nothing when history is missing", () => {
    const { host, actions } = actionsFor();
    actions.openAppTab(todo);
    actions.toggleBrowse("history");
    expect(host.calls.historyList).toEqual([]);
    expect(getPanelState().browseOpen).toBe(false);
  });

  it("toggleBrowse lists storage tables", async () => {
    const host = createFakePanelHost({
      apps: [todo],
      withStorage: true,
      tables: [{ name: "kv", size: 2 }],
      tableValue: { a: 1 },
    });
    const { actions } = actionsFor(host);
    actions.openAppTab(todo);
    actions.toggleBrowse("storage");
    await flush();
    expect(host.calls.storageList).toEqual(["com.example.todo"]);
    actions.loadTable("kv");
    await flush();
    expect(host.calls.storageRead).toEqual([{ appId: "com.example.todo", name: "kv" }]);
    expect(getPanelState().browseTableValue).toEqual({ a: 1 });
  });

  it("confirmDelete calls host.deleteApp and drops the tab", async () => {
    const host = createFakePanelHost({ apps: [todo], withDelete: true });
    const { actions } = actionsFor(host);
    setPanelState({ apps: [todo] });
    actions.openAppTab(todo);
    actions.askDelete();
    expect(getPanelState().pendingDelete).toBe("com.example.todo");
    await actions.confirmDelete();
    expect(host.calls.deleteApp).toEqual(["com.example.todo"]);
    expect(getPanelState().apps).toEqual([]);
    expect(host.calls.unmount).toContain("com.example.todo");
  });

  it("defaultHideThemePop closes an open popover", () => {
    const { actions } = actionsFor();
    expect(defaultHideThemePop()).toBe(false);
    actions.toggleThemePop();
    expect(getPanelState().themePopOpen).toBe(true);
    expect(defaultHideThemePop()).toBe(true);
    expect(getPanelState().themePopOpen).toBe(false);
  });

  it("clampPaletteId falls back to default", () => {
    expect(clampPaletteId("tokyo")).toBe("tokyo");
    expect(clampPaletteId("nope")).toBe("default");
  });

  it("browseBack and browseFile toggle commit file preview", async () => {
    const host = createFakePanelHost({
      apps: [todo],
      withHistory: true,
      historyDetail: {
        id: "abc",
        message: "init",
        time: "t",
        files: [{ path: "ui.tsx", add: 2, del: 1, preview: "+x" }],
      },
    });
    const { actions } = actionsFor(host);
    actions.openAppTab(todo);
    actions.toggleBrowse("history");
    await flush();
    actions.loadCommitDetail("abc");
    await flush();
    actions.browseFile("ui.tsx");
    expect(getPanelState().browseOpenFile).toBe("ui.tsx");
    actions.browseFile("ui.tsx");
    expect(getPanelState().browseOpenFile).toBeNull();
    actions.browseBack();
    expect(getPanelState().browseDetail).toBeNull();
  });

  it("capabilitiesOf reflects optional host methods", () => {
    expect(capabilitiesOf(createFakePanelHost())).toEqual({
      history: false,
      storage: false,
      config: false,
      appTheme: false,
      customPalettes: false,
      deleteApp: false,
    });
    expect(
      capabilitiesOf(
        createFakePanelHost({
          withHistory: true,
          withStorage: true,
          withConfig: true,
          withAppTheme: true,
          withPalettes: true,
          withDelete: true,
        }),
      ),
    ).toEqual({
      history: true,
      storage: true,
      config: true,
      appTheme: true,
      customPalettes: true,
      deleteApp: true,
    });
  });
});
