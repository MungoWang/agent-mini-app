/** @monkey-mini-app/panel-core 类型定义（纯 React，零宿主依赖） */

export type AppItem = Record<string, unknown> & { id: string; name?: string; description?: string; acronym?: string; commits?: number; theme?: unknown }

export type TabItem = { id: string; title: string; kind: string; app?: AppItem }

export type BrowseKind = "history" | "storage"

/**
 * 面板需要的宿主能力（由宿主实现并注入）。
 * 这是「plugin-core 可复用」的接缝：任何 web 项目实现这套 actions
 * 即可渲染 MiniAppPanel，不依赖 dsh。
 */
export type MiniAppActions = {
  openAppTab: (app: AppItem) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void
  setDock: (next: string) => void
  setQuery: (q: string) => void
  toggleThemePop: () => void
  setAppearance: (next: Record<string, unknown>, scope: string) => void
  setThemeScope: (scope: string) => void
  clearAppTheme: () => void
  getActiveApp: () => AppItem | null
  toggleSettings: (open: boolean) => void
  getCfg: () => Record<string, string>
  saveHostConfig: (form: Record<string, string>) => void
  toggleBrowse: (kind: string) => void
  loadCommitDetail: (id: string) => void
  loadTable: (name: string) => void
  browseBack: () => void
  browseFile: (path: string) => void
  reloadActive: () => void
  askDelete: () => void
  hideModal: () => void
  confirmDelete: () => void
  closeDashboard: () => void
  fetchApps: () => void
  setCardStyle: (v: string) => void
}

export type PanelState = {
  tabs: TabItem[]
  active: string
  apps: AppItem[]
  error: string | null
  loading: boolean
  query: string
  dock: string
  theme: string
  palette: string
  themeScope: string
  customPalettes: Record<string, unknown>
  cardStyle: string
  visible: boolean
  pendingDelete: string | null
  themePopOpen: boolean
  settingsOpen: boolean
  cfgMsg: string
  cfgVersion: number
  cfg: Record<string, string>
  emptyText: string | undefined
  browseOpen: boolean
  browseKind: BrowseKind
  browseAppId: string | null
  browseAppName: string
  browseLoading: boolean
  browseError: string | null
  browseList: unknown[]
  browseDetail: unknown
  browseTable: string | null
  browseTableValue: unknown
  browseOpenFile: string | null
}
