import type { AppItem, Commit, Palette, PanelHost, StorageTable } from "@monkey-mini-app/panel";

export type FakePanelHostCalls = {
  fetchApps: number;
  mount: string[];
  unmount: string[];
  reload: string[];
  openPanel: number;
  closePanel: number;
  persistTheme: Array<{ theme: string; palette: string }>;
  historyList: string[];
  historyDetail: Array<{ appId: string; id: string }>;
  storageList: string[];
  storageRead: Array<{ appId: string; name: string }>;
  configLoad: number;
  configSave: Array<Record<string, string>>;
  deleteApp: string[];
  palettes: number;
  appThemeSave: Array<{ appId: string; theme: string; palette: string }>;
  appThemeClear: string[];
  syncEnv: number;
};

export type FakePanelHost = PanelHost & { calls: FakePanelHostCalls };

export type FakePanelHostOptions = {
  apps?: AppItem[];
  locale?: "zh-CN" | "en";
  emptyText?: string;
  fetchError?: Error;
  url?: (appId: string) => string;
  history?: Commit[];
  historyDetail?: Commit;
  tables?: StorageTable[];
  tableValue?: unknown;
  config?: Record<string, string>;
  palettes?: Palette[];
  withHistory?: boolean;
  withStorage?: boolean;
  withConfig?: boolean;
  withAppTheme?: boolean;
  withPalettes?: boolean;
  withDelete?: boolean;
};

function emptyCalls(): FakePanelHostCalls {
  return {
    fetchApps: 0,
    mount: [],
    unmount: [],
    reload: [],
    openPanel: 0,
    closePanel: 0,
    persistTheme: [],
    historyList: [],
    historyDetail: [],
    storageList: [],
    storageRead: [],
    configLoad: 0,
    configSave: [],
    deleteApp: [],
    palettes: 0,
    appThemeSave: [],
    appThemeClear: [],
    syncEnv: 0,
  };
}

export function createFakePanelHost(options: FakePanelHostOptions = {}): FakePanelHost {
  const apps = options.apps ?? [];
  const host: FakePanelHost = {
    locale: options.locale ?? "zh-CN",
    emptyText: options.emptyText,
    calls: emptyCalls(),
    fetchApps: async () => {
      host.calls.fetchApps += 1;
      if (options.fetchError) throw options.fetchError;
      return apps;
    },
    frame: {
      url: (appId) => (options.url ? options.url(appId) : `app://${appId}`),
      mount: (appId) => {
        host.calls.mount.push(appId);
      },
      unmount: (appId) => {
        host.calls.unmount.push(appId);
      },
      reload: (appId) => {
        host.calls.reload.push(appId);
      },
      syncEnv: () => {
        host.calls.syncEnv += 1;
      },
    },
    openPanel: () => {
      host.calls.openPanel += 1;
    },
    closePanel: () => {
      host.calls.closePanel += 1;
    },
    persistTheme: (theme, palette) => {
      host.calls.persistTheme.push({ theme, palette });
    },
  };

  if (options.withHistory) {
    host.history = {
      list: async (appId) => {
        host.calls.historyList.push(appId);
        return options.history ?? [];
      },
      detail: async (appId, id) => {
        host.calls.historyDetail.push({ appId, id });
        return (
          options.historyDetail ?? {
            id,
            message: "detail",
            time: "now",
            files: [{ path: "ui.tsx", add: 1, del: 0, preview: "x" }],
          }
        );
      },
    };
  }

  if (options.withStorage) {
    host.storage = {
      listTables: async (appId) => {
        host.calls.storageList.push(appId);
        return options.tables ?? [];
      },
      readTable: async (appId, name) => {
        host.calls.storageRead.push({ appId, name });
        return options.tableValue ?? { rows: [] };
      },
    };
  }

  if (options.withConfig) {
    host.config = {
      load: async () => {
        host.calls.configLoad += 1;
        return options.config ?? { hostPort: "17880", locale: "zh-CN" };
      },
      save: async (cfg) => {
        host.calls.configSave.push({ ...cfg });
      },
    };
  }

  if (options.withAppTheme) {
    host.appTheme = {
      save: async (appId, t) => {
        host.calls.appThemeSave.push({ appId, theme: t.theme, palette: t.palette });
      },
      clear: async (appId) => {
        host.calls.appThemeClear.push(appId);
      },
    };
  }

  if (options.withPalettes) {
    host.palettes = async () => {
      host.calls.palettes += 1;
      return options.palettes ?? [{ id: "custom-1", label: "Custom One", swatch: "#abc" }];
    };
  }

  if (options.withDelete) {
    host.deleteApp = async (appId) => {
      host.calls.deleteApp.push(appId);
    };
  }

  return host;
}
