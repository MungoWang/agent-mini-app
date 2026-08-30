import type { PanelI18n } from "./i18n.ts";
import type { PanelHost } from "./panel-host.ts";
import { capabilitiesOf } from "./panel-host.ts";
import { isHostUnreachable } from "./rest.ts";
import { getPanelState, setPanelState } from "./store.ts";
import { applyThemeTo, clampPalette, type CustomPaletteMap } from "./themes.ts";
import type { AppItem, CardStyle, DockId, PanelActions, PanelState, TabItem } from "./types.ts";

export function activeAppFrom(state: PanelState): AppItem | null {
  const tab =
    state.tabs.find((t) => t.kind === "app" && t.id === state.active) ||
    state.tabs.find((t) => t.kind === "app");
  return tab?.app ?? null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function pushAppTab(app: AppItem): string {
  const s = getPanelState();
  const id = "app:" + app.id;
  if (!s.tabs.some((t) => t.id === id)) {
    setPanelState({ tabs: [...s.tabs, { id, title: app.name || app.id, kind: "app", app }] });
  }
  return id;
}

function asCustomPalettes(value: PanelState["customPalettes"]): CustomPaletteMap {
  return value as CustomPaletteMap;
}

export function createPanelActions(
  host: PanelHost,
  getRootEl: () => HTMLElement | null,
  i18n: PanelI18n,
): PanelActions {
  setPanelState({ capabilities: capabilitiesOf(host), locale: i18n.locale, emptyText: host.emptyText });

  return {
    openAppTab: (app) => {
      const id = pushAppTab(app);
      setPanelState({ active: id });
      host.frame.mount(app.id);
    },
    closeTab: (id) => {
      if (id === "all") return;
      const s = getPanelState();
      const tab = s.tabs.find((t) => t.id === id);
      setPanelState({
        tabs: s.tabs.filter((t) => t.id !== id),
        active: s.active === id ? "all" : s.active,
      });
      if (tab?.app) host.frame.unmount(tab.app.id);
    },
    switchTab: (id) => {
      setPanelState({ active: id });
      const s = getPanelState();
      const tab = s.tabs.find((t) => t.id === id && t.kind === "app");
      if (tab?.app) host.frame.mount(tab.app.id);
    },
    setDock: (next: DockId) => {
      setPanelState({ dock: next });
      try {
        localStorage.setItem("mma-dock", next);
      } catch {
        /* ignore */
      }
    },
    setQuery: (q) => setPanelState({ query: q }),
    toggleThemePop: () => setPanelState({ themePopOpen: !getPanelState().themePopOpen }),
    setAppearance: (next, scope) => {
      const s = getPanelState();
      const theme = next.theme ? String(next.theme) : s.theme;
      const palette = next.palette ? String(next.palette) : s.palette;
      setPanelState({ theme, palette });
      const root = getRootEl();
      if (root) {
        applyThemeTo(root, theme, palette, asCustomPalettes(s.customPalettes));
      }
      if (scope === "app") {
        const app = activeAppFrom(getPanelState());
        if (app && host.appTheme) {
          const nextTheme = { theme, palette };
          host.appTheme.save(app.id, nextTheme).catch(() => {});
          const cur = getPanelState();
          setPanelState({
            apps: cur.apps.some((a) => a.id === app.id)
              ? cur.apps.map((a) => (a.id === app.id ? { ...a, theme: nextTheme } : a))
              : [...cur.apps, { ...app, theme: nextTheme }],
            tabs: cur.tabs.map((t) =>
              t.app?.id === app.id ? { ...t, app: { ...t.app, theme: nextTheme } } : t,
            ),
          });
        }
      } else {
        host.persistTheme?.(theme, palette);
      }
      host.frame.syncEnv?.();
    },
    setThemeScope: (scope) => setPanelState({ themeScope: scope }),
    clearAppTheme: () => {
      const app = activeAppFrom(getPanelState());
      if (app && host.appTheme) {
        host.appTheme.clear(app.id).catch(() => {});
        const cur = getPanelState();
        setPanelState({
          apps: cur.apps.map((a) => (a.id === app.id ? { ...a, theme: null } : a)),
          tabs: cur.tabs.map((t) =>
            t.app?.id === app.id ? { ...t, app: { ...t.app, theme: null } } : t,
          ),
        });
        host.frame.syncEnv?.();
      }
    },
    getActiveApp: () => activeAppFrom(getPanelState()),
    toggleSettings: (open) => {
      setPanelState({ settingsOpen: open, cfgMsg: open ? "" : getPanelState().cfgMsg });
      if (open && host.config) {
        host.config
          .load()
          .then((cfg) => {
            setPanelState({ cfg, cfgVersion: getPanelState().cfgVersion + 1 });
          })
          .catch(() => {});
      }
    },
    getCfg: () => getPanelState().cfg,
    saveHostConfig: (form) => {
      if (!host.config) return;
      host.config
        .save(form)
        .then(() => {
          setPanelState({
            cfg: { ...form },
            cfgMsg: i18n.t("config.saved"),
            cfgVersion: getPanelState().cfgVersion + 1,
          });
        })
        .catch((e) => {
          setPanelState({ cfgMsg: i18n.t("config.error", { message: errorMessage(e) }) });
        });
    },
    toggleBrowse: (kind) => {
      const s = getPanelState();
      if (s.browseOpen) {
        setPanelState({ browseOpen: false });
        return;
      }
      const app = activeAppFrom(s);
      if (!app) return;
      const k = kind === "storage" ? "storage" : "history";
      if (k === "history" && !host.history) return;
      if (k === "storage" && !host.storage) return;
      setPanelState({
        browseOpen: true,
        browseKind: k,
        browseAppId: app.id,
        browseAppName: app.name || app.id,
        browseDetail: null,
        browseTable: null,
        browseTableValue: null,
        browseOpenFile: null,
        browseError: null,
        browseList: [],
        browseLoading: true,
      });
      if (k === "history" && host.history) {
        host.history
          .list(app.id)
          .then((list) => {
            setPanelState({ browseList: list, browseLoading: false });
          })
          .catch((e) => setPanelState({ browseError: errorMessage(e), browseLoading: false }));
      } else if (host.storage) {
        host.storage
          .listTables(app.id)
          .then((list) => {
            setPanelState({ browseList: list, browseLoading: false });
          })
          .catch((e) => setPanelState({ browseError: errorMessage(e), browseLoading: false }));
      }
    },
    loadCommitDetail: (id) => {
      const s = getPanelState();
      if (!host.history || !s.browseAppId) return;
      setPanelState({ browseDetail: { id, loading: true } });
      host.history
        .detail(s.browseAppId, id)
        .then((c) => {
          setPanelState({ browseDetail: c });
        })
        .catch((e) => setPanelState({ browseDetail: { id, error: errorMessage(e), files: [] } }));
    },
    loadTable: (name) => {
      const s = getPanelState();
      if (!host.storage || !s.browseAppId) return;
      setPanelState({ browseTable: name, browseTableValue: null, browseLoading: true });
      host.storage
        .readTable(s.browseAppId, name)
        .then((v) => {
          setPanelState({ browseTableValue: v, browseLoading: false });
        })
        .catch((e) =>
          setPanelState({ browseTableValue: { __error__: errorMessage(e) }, browseLoading: false }),
        );
    },
    browseBack: () =>
      setPanelState({ browseDetail: null, browseTable: null, browseTableValue: null, browseOpenFile: null }),
    browseFile: (path) =>
      setPanelState({ browseOpenFile: getPanelState().browseOpenFile === path ? null : path }),
    reloadActive: () => {
      const app = activeAppFrom(getPanelState());
      if (app) host.frame.reload(app.id);
    },
    askDelete: () => {
      const app = activeAppFrom(getPanelState());
      if (app) setPanelState({ pendingDelete: app.id });
    },
    hideModal: () => setPanelState({ pendingDelete: null }),
    confirmDelete: async () => {
      const s = getPanelState();
      const id = s.pendingDelete;
      if (!id) return;
      setPanelState({ pendingDelete: null });
      if (host.deleteApp) {
        await host.deleteApp(id).catch(() => {});
      }
      const tab = s.tabs.find((t) => t.id === "app:" + id);
      setPanelState({
        tabs: getPanelState().tabs.filter((t) => t.id !== "app:" + id),
        active: getPanelState().active === "app:" + id ? "all" : getPanelState().active,
        apps: getPanelState().apps.filter((a) => a.id !== id),
      });
      if (tab?.app) host.frame.unmount(tab.app.id);
    },
    closeDashboard: () => host.closePanel(),
    fetchApps: () => {
      setPanelState({ loading: true, error: null, emptyText: host.emptyText });
      host
        .fetchApps()
        .then((apps) => {
          setPanelState({ apps, loading: false });
        })
        .catch((e) => {
          setPanelState({
            error: isHostUnreachable(e)
              ? i18n.t("list.hostUnreachable", { url: e.url })
              : errorMessage(e),
            loading: false,
          });
        });
    },
    setCardStyle: (v: CardStyle) => setPanelState({ cardStyle: v }),
  };
}

export function defaultHideThemePop(): boolean {
  if (!getPanelState().themePopOpen) return false;
  setPanelState({ themePopOpen: false });
  return true;
}

export function clampPaletteId(v: unknown): string {
  return clampPalette(v as never);
}

export type { TabItem };
