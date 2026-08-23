import path from "node:path";
import * as themeLight from "@monkey-mini-app/theme-light";
import * as themeDark from "@monkey-mini-app/theme-dark";
import {
  type HostPort,
  type RuntimePort,
  type Manifest,
  type HistoryPort,
  type MountTarget,
  type CapabilityDescriptor,
  type AppTab,
  parseManifest,
} from "@monkey-mini-app/host-port";
import { createStorageHandlers } from "./storage.js";
import { attachBridgeHub } from "./bridge-hub.js";
import {
  createLoopbackPair,
  createMiniClient,
} from "@monkey-mini-app/api-client";
import type { Transport } from "@monkey-mini-app/bridge-protocol";

export type CreateRuntimeOptions = {
  host: HostPort;
  history?: HistoryPort;
  themeId?: string;
  appsRoot?: string;
  storage?: { directory?: string; defaultFile?: string };
  /** Optional theme token providers keyed by id */
  themes?: Record<
    string,
    { id: string; label: string; getTokens: () => Record<string, string> }
  >;
};

export type Runtime = RuntimePort & {
  getHost(): HostPort;
  /** Open a bridge session for an app (in-process). */
  openBridge(appId: string): {
    mini: ReturnType<typeof createMiniClient>;
    dispose: () => void;
  };
  applyThemeTokens(): Record<string, string>;
  getAppDir(appId: string): string;
};

type ThemePack = {
  id: string;
  label: string;
  getTokens: () => Record<string, string>;
};

const DEFAULT_THEMES: Record<string, ThemePack> = {
  light: themeLight as ThemePack,
  dark: themeDark as ThemePack,
};

export async function createRuntime(
  options: CreateRuntimeOptions
): Promise<Runtime> {
  const host = options.host;
  const appsRoot = options.appsRoot ?? "apps";
  const storageCfg = {
    directory: options.storage?.directory ?? "storage",
    defaultFile: options.storage?.defaultFile ?? "default.json",
  };
  const themes = options.themes ?? DEFAULT_THEMES;
  let themeId = options.themeId ?? "light";
  const history = options.history;

  const manifests = new Map<string, Manifest>();
  const mounted = new Set<string>();
  const bridgeDisposers = new Map<string, () => void>();
  const tabs = new Map<string, AppTab>();
  let activeTabId: string | null = null;
  let tabSeq = 0;

  const storage = createStorageHandlers(host, storageCfg);

  async function refreshRegistry(): Promise<void> {
    manifests.clear();
    const names = await host.listDir(appsRoot);
    for (const name of names) {
      const manPath = path.join(appsRoot, name, "manifest.json");
      if (!(await host.exists(manPath))) continue;
      try {
        const raw = await host.readFile(manPath);
        const text =
          typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        const m = parseManifest(text);
        if (m.id !== name) {
          host.log?.(
            "warn",
            `manifest id ${m.id} !== dir ${name}, using dir as id`
          );
        }
        manifests.set(name, { ...m, id: name });
      } catch (e) {
        host.log?.("warn", `skip app ${name}`, e);
      }
    }
  }

  await refreshRegistry();

  function getAppDir(appId: string): string {
    return path.join(host.getRuntimeRoot(), appsRoot, appId);
  }

  function applyThemeTokens(): Record<string, string> {
    const pack = themes[themeId] ?? themes.light!;
    return pack.getTokens();
  }

  function listCapabilities(): CapabilityDescriptor[] {
    return [
      {
        name: "storage.get",
        source: "runtime",
        permission: "storage",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            file: { type: "string" },
          },
          required: ["key"],
        },
      },
      {
        name: "storage.set",
        source: "runtime",
        permission: "storage",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: {},
            file: { type: "string" },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "theme.get",
        source: "runtime",
        inputSchema: { type: "object" },
      },
      {
        name: "ui.toast",
        source: "runtime",
        permission: "ui",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
    ];
  }

  function openBridge(appId: string) {
    if (!manifests.has(appId)) {
      throw new Error(`unknown app: ${appId}`);
    }
    const { miniTransport, hostTransport } = createLoopbackPair();
    const disposeHub = attachBridgeHub(appId, hostTransport, {
      host,
      getManifest: (id) => manifests.get(id) ?? null,
      storage,
      getThemeId: () => themeId,
    });
    const mini = createMiniClient(miniTransport);
    const dispose = () => {
      disposeHub();
    };
    return { mini, dispose };
  }

  const runtime: Runtime = {
    getHost: () => host,
    getAppDir,
    applyThemeTokens,
    openBridge,

    async listApps() {
      await refreshRegistry();
      return [...manifests.values()].map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        description: m.description || "",
        enabled: true,
      }));
    },

    async getApp(id) {
      await refreshRegistry();
      const m = manifests.get(id);
      if (!m) return null;
      return {
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: true,
        permissions: m.permissions,
      };
    },

    async mount(id, _target: MountTarget) {
      await refreshRegistry();
      if (!manifests.has(id)) throw new Error(`unknown app: ${id}`);
      mounted.add(id);
      // Headless / in-process: bridge is opened by consumer via openBridge.
      // WebView targets are host-specific (Tauri adapter).
    },

    async unmount(id) {
      mounted.delete(id);
      bridgeDisposers.get(id)?.();
      bridgeDisposers.delete(id);
    },

    async listThemes() {
      return Object.values(themes).map((t) => ({ id: t.id, label: t.label }));
    },

    async getTheme() {
      return themeId;
    },

    async setTheme(id) {
      if (!themes[id]) throw new Error(`unknown theme: ${id}`);
      themeId = id;
    },

    async registerAppFromFiles(appId, files) {
      if (appId.includes("..") || appId.includes("/") || appId.includes("\\")) {
        throw new Error("INVALID_APP_ID");
      }
      for (const [rel, content] of Object.entries(files)) {
        if (rel.includes("..")) throw new Error("PATH_ESCAPE");
        const dest = path.join(appsRoot, appId, rel);
        await host.writeFile(dest, content);
      }
      await refreshRegistry();
      if (history) {
        const appDir = getAppDir(appId);
        await history.init(appDir);
        try {
          await history.commit(appDir, "registerAppFromFiles");
        } catch {
          /* empty tree ok */
        }
      }
    },

    async removeApp(appId) {
      // only remove tracked mount; full recursive delete left to host tools
      mounted.delete(appId);
      manifests.delete(appId);
      const marker = path.join(appsRoot, appId, "manifest.json");
      if (await host.exists(marker)) {
        // write tombstone by clearing manifest only if host supports; skip hard delete in core
        host.log?.("info", `removeApp: unregister ${appId}`);
      }
    },

    async listCapabilities() {
      return listCapabilities();
    },

    async historyCommit(appId, message) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.commit(getAppDir(appId), message);
    },

    async historyList(appId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.listCommits(getAppDir(appId), opts);
    },

    async historyRevert(appId, commitId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.revert(getAppDir(appId), commitId, opts);
    },

    async historyResetTo(appId, commitId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.resetTo(getAppDir(appId), commitId, opts);
    },

    async openTab(appId, opts) {
      await refreshRegistry();
      if (!manifests.has(appId)) throw new Error(`unknown app: ${appId}`);
      const m = manifests.get(appId)!;
      tabSeq += 1;
      const tabId = `tab_${Date.now()}_${tabSeq}`;
      const tab: AppTab = {
        tabId,
        appId,
        title: opts?.title ?? m.name,
        createdAt: new Date().toISOString(),
      };
      tabs.set(tabId, tab);
      activeTabId = tabId;
      mounted.add(appId);
      return tab;
    },

    async closeTab(tabId) {
      if (!tabs.has(tabId)) throw new Error(`unknown tab: ${tabId}`);
      const tab = tabs.get(tabId)!;
      tabs.delete(tabId);
      if (activeTabId === tabId) {
        const rest = [...tabs.keys()];
        activeTabId = rest.length ? rest[rest.length - 1]! : null;
      }
      // unmount app only if no tab left for it
      const still = [...tabs.values()].some((x) => x.appId === tab.appId);
      if (!still) {
        mounted.delete(tab.appId);
        bridgeDisposers.get(tab.appId)?.();
        bridgeDisposers.delete(tab.appId);
      }
    },

    async listTabs() {
      return [...tabs.values()];
    },

    async focusTab(tabId) {
      if (!tabs.has(tabId)) throw new Error(`unknown tab: ${tabId}`);
      activeTabId = tabId;
    },

    async getActiveTab() {
      if (!activeTabId) return null;
      return tabs.get(activeTabId) ?? null;
    },
  };

  return runtime;
}

export { createStorageHandlers } from "./storage.js";
export { attachBridgeHub } from "./bridge-hub.js";
