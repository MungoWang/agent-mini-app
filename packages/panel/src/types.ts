export const LOCALE_IDS = ["zh-CN", "en"] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export type AppItem = {
  id: string;
  name: string;
  description?: string;
  acronym?: string;
  commits?: number;
  version?: string;
  theme?: { theme: string; palette: string } | null;
};

export type TabKind = "all" | "app";
export type TabItem = { id: string; title: string; kind: TabKind; app?: AppItem };

export type BrowseKind = "history" | "storage";
export type ThemeScope = "global" | "app";
export type DockId = "fill" | "side";
export type CardStyle = "stamp" | "etch" | "hero" | "list";

export type CommitFile = {
  path: string;
  add?: number;
  del?: number;
  preview?: string;
};

export type Commit = {
  id: string;
  message: string;
  time: string;
  files?: CommitFile[];
};

export type StorageTable = {
  name: string;
  size?: number;
  updatedAt?: string;
};

export type PanelCapabilities = {
  history: boolean;
  storage: boolean;
  config: boolean;
  appTheme: boolean;
  customPalettes: boolean;
  deleteApp: boolean;
};

export type PanelActions = {
  openAppTab: (app: AppItem) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  setDock: (next: DockId) => void;
  setQuery: (q: string) => void;
  toggleThemePop: () => void;
  setAppearance: (next: { theme?: string; palette?: string }, scope: string) => void;
  setThemeScope: (scope: ThemeScope) => void;
  clearAppTheme: () => void;
  getActiveApp: () => AppItem | null;
  toggleSettings: (open: boolean) => void;
  getCfg: () => Record<string, string>;
  saveHostConfig: (form: Record<string, string>) => void;
  toggleBrowse: (kind: string) => void;
  loadCommitDetail: (id: string) => void;
  loadTable: (name: string) => void;
  browseBack: () => void;
  browseFile: (path: string) => void;
  reloadActive: () => void;
  askDelete: () => void;
  hideModal: () => void;
  confirmDelete: () => void | Promise<void>;
  closeDashboard: () => void;
  fetchApps: () => void;
  setCardStyle: (v: CardStyle) => void;
};

export type PanelState = {
  tabs: TabItem[];
  active: string;
  apps: AppItem[];
  error: string | null;
  loading: boolean;
  query: string;
  dock: DockId;
  theme: string;
  palette: string;
  themeScope: ThemeScope;
  customPalettes: Record<string, { label?: string; swatch?: string; tokens?: unknown }>;
  cardStyle: CardStyle;
  visible: boolean;
  pendingDelete: string | null;
  themePopOpen: boolean;
  settingsOpen: boolean;
  cfgMsg: string;
  cfgVersion: number;
  cfg: Record<string, string>;
  emptyText: string | undefined;
  capabilities: PanelCapabilities;
  locale: LocaleId;
  browseOpen: boolean;
  browseKind: BrowseKind;
  browseAppId: string | null;
  browseAppName: string;
  browseLoading: boolean;
  browseError: string | null;
  browseList: unknown[];
  browseDetail: unknown;
  browseTable: string | null;
  browseTableValue: unknown;
  browseOpenFile: string | null;
};
