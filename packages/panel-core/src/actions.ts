/**
 * panel-core 默认行为：纯 UI 状态流转 + 调 adapter 能力。
 * 宿主只需实现 MiniAppAdapter，无需重写这些。
 */
import { getPanelState, setPanelState } from "./store.js"
import { applyThemeTo, clampPalette, type CustomPaletteMap } from "./themes.js"
import type { AppItem, MiniAppActions, PanelState, TabItem } from "./types.js"
import type { MiniAppAdapter } from "./adapter.js"

export function activeAppFrom(state: PanelState): AppItem | null {
  const tab =
    state.tabs.find((t) => t.kind === "app" && t.id === state.active) ||
    state.tabs.find((t) => t.kind === "app")
  return (tab && tab.app) || null
}

function pushAppTab(app: AppItem): string {
  const s = getPanelState()
  const id = "app:" + app.id
  if (!s.tabs.some((t) => t.id === id)) {
    setPanelState({ tabs: [...s.tabs, { id, title: app.name || app.id, kind: "app", app }] })
  }
  return id
}

let cfgCache: Record<string, string> | null = null

export function createPanelActions(adapter: MiniAppAdapter, getRootEl: () => HTMLElement | null): MiniAppActions {
  return {
    openAppTab: (app) => {
      const id = pushAppTab(app)
      setPanelState({ active: id })
      adapter.frame.mount(app.id)
    },
    closeTab: (id) => {
      const s = getPanelState()
      const tab = s.tabs.find((t) => t.id === id)
      setPanelState({
        tabs: s.tabs.filter((t) => t.id !== id),
        active: s.active === id ? "all" : s.active,
      })
      if (tab && tab.app) adapter.frame.unmount(tab.app.id)
    },
    switchTab: (id) => {
      setPanelState({ active: id })
      const s = getPanelState()
      const tab = s.tabs.find((t) => t.id === id && t.kind === "app")
      if (tab && tab.app) adapter.frame.mount(tab.app.id)
    },
    setDock: (next) => {
      setPanelState({ dock: next })
      try {
        localStorage.setItem("mma-dock", next)
      } catch (_) {}
    },
    setQuery: (q) => setPanelState({ query: q }),
    toggleThemePop: () => setPanelState({ themePopOpen: !getPanelState().themePopOpen }),
    setAppearance: (next, scope) => {
      const s = getPanelState()
      const theme = next.theme ? String(next.theme) : s.theme
      const palette = next.palette ? String(next.palette) : s.palette
      setPanelState({ theme, palette })
      const root = getRootEl()
      if (root) {
        const custom = (s.customPalettes || {}) as CustomPaletteMap
        applyThemeTo(root, theme, palette, custom)
      }
      if (scope === "app") {
        const app = activeAppFrom(getPanelState())
        if (app && adapter.appTheme) {
          adapter.appTheme.save(app.id, { theme, palette }).catch(() => {})
        }
      } else {
        adapter.persistTheme?.(theme, palette)
      }
    },
    setThemeScope: (scope) => setPanelState({ themeScope: scope }),
    clearAppTheme: () => {
      const app = activeAppFrom(getPanelState())
      if (app && adapter.appTheme) adapter.appTheme.clear(app.id).catch(() => {})
    },
    getActiveApp: () => activeAppFrom(getPanelState()),
    toggleSettings: (open) => {
      setPanelState({ settingsOpen: open })
      if (open && adapter.config) {
        adapter.config.load().then((cfg) => {
          cfgCache = cfg
          setPanelState({ cfg: cfg, cfgVersion: getPanelState().cfgVersion + 1 })
        }).catch(() => {})
      }
    },
    getCfg: () => cfgCache || {},
    saveHostConfig: (form) => {
      if (!adapter.config) return
      adapter.config.save(form).then(() => {
        cfgCache = { ...form }
        setPanelState({ cfg: { ...form }, cfgMsg: "已保存", cfgVersion: getPanelState().cfgVersion + 1 })
      }).catch((e) => {
        setPanelState({ cfgMsg: "✗ " + String(e?.message || e) })
      })
    },
    toggleBrowse: (kind) => {
      const s = getPanelState()
      if (s.browseOpen) {
        setPanelState({ browseOpen: false })
        return
      }
      const app = activeAppFrom(s)
      if (!app) return
      const k = kind === "storage" ? "storage" : "history"
      setPanelState({ browseOpen: true, browseKind: k, browseAppId: app.id, browseAppName: app.name || app.id, browseDetail: null, browseTable: null, browseTableValue: null, browseLoading: true })
      if (k === "history" && adapter.history) {
        adapter.history.list(app.id).then((list) => {
          setPanelState({ browseList: list, browseLoading: false })
        }).catch((e) => setPanelState({ browseError: String(e?.message || e), browseLoading: false }))
      } else if (adapter.storage) {
        adapter.storage.listTables(app.id).then((list) => {
          setPanelState({ browseList: list, browseLoading: false })
        }).catch((e) => setPanelState({ browseError: String(e?.message || e), browseLoading: false }))
      }
    },
    loadCommitDetail: (id) => {
      const s = getPanelState()
      if (!adapter.history || !s.browseAppId) return
      setPanelState({ browseDetail: { id, loading: true } })
      adapter.history.detail(s.browseAppId, id).then((c) => {
        setPanelState({ browseDetail: c })
      }).catch((e) => setPanelState({ browseDetail: { id, error: String(e?.message || e), files: [] } }))
    },
    loadTable: (name) => {
      const s = getPanelState()
      if (!adapter.storage || !s.browseAppId) return
      setPanelState({ browseTable: name, browseTableValue: null, browseLoading: true })
      adapter.storage.readTable(s.browseAppId, name).then((v) => {
        setPanelState({ browseTableValue: v, browseLoading: false })
      }).catch((e) => setPanelState({ browseTableValue: { __error__: String(e?.message || e) }, browseLoading: false }))
    },
    browseBack: () => setPanelState({ browseDetail: null, browseTable: null, browseTableValue: null, browseOpenFile: null }),
    browseFile: (path) => setPanelState({ browseOpenFile: getPanelState().browseOpenFile === path ? null : path }),
    reloadActive: () => {
      const app = activeAppFrom(getPanelState())
      if (app) adapter.frame.reload(app.id)
    },
    askDelete: () => {
      const app = activeAppFrom(getPanelState())
      if (app) setPanelState({ pendingDelete: app.id })
    },
    hideModal: () => setPanelState({ pendingDelete: null }),
    confirmDelete: async () => {
      const s = getPanelState()
      const id = s.pendingDelete
      if (!id) return
      setPanelState({ pendingDelete: null })
      if (adapter.deleteApp) {
        await adapter.deleteApp(id).catch(() => {})
      }
      const tab = s.tabs.find((t) => t.id === "app:" + id)
      setPanelState({
        tabs: getPanelState().tabs.filter((t) => t.id !== "app:" + id),
        active: getPanelState().active === "app:" + id ? "all" : getPanelState().active,
        apps: getPanelState().apps.filter((a) => a.id !== id),
      })
      if (tab && tab.app) adapter.frame.unmount(tab.app.id)
    },
    closeDashboard: () => adapter.closePanel(),
    fetchApps: () => {
      setPanelState({ loading: true, error: null, emptyText: adapter.emptyText })
      adapter.listApps().then((apps) => {
        setPanelState({ apps, loading: false })
      }).catch((e) => setPanelState({ error: String(e?.message || e), loading: false }))
    },
    setCardStyle: (v) => setPanelState({ cardStyle: v }),
  }
}

/** 便捷：默认 hideThemePop（Escape 用） */
export function defaultHideThemePop(): boolean {
  if (!getPanelState().themePopOpen) return false
  setPanelState({ themePopOpen: false })
  return true
}

export function clampPaletteId(v: unknown): string {
  return clampPalette(v as never)
}

export type { TabItem }
