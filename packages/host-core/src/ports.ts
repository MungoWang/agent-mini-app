export type HostPort = {
  getRuntimeRoot(): string;
  readFile(path: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  listDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir?(path: string, opts?: { recursive?: boolean }): Promise<void>;
  invoke(name: string, payload: unknown): Promise<unknown>;
  getSystemColorScheme?(): Promise<"light" | "dark" | "no-preference">;
  log?(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: unknown
  ): void;
};

export type AppSummary = {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
};

export type AppTab = {
  tabId: string;
  appId: string;
  title: string;
  createdAt: string;
};

export type MountTarget =
  | { type: "element"; element: unknown }
  | { type: "webview"; id: string }
  | { type: "iframe"; iframe: unknown }
  | { type: "headless" };

export type CapabilityDescriptor = {
  name: string;
  source: "runtime" | "host";
  permission?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  description?: string;
};

export type CommitNode = {
  id: string;
  parentIds: string[];
  message: string;
  time: string;
};

export type CommitTree = {
  head: string;
  nodes: CommitNode[];
  tips?: { name: string; commitId: string }[];
};

export type HistoryPort = {
  init(appDir: string): Promise<void>;
  commit(
    appDir: string,
    message: string,
    opts?: { author?: { name: string; email: string } }
  ): Promise<{ commitId: string }>;
  listCommits(
    appDir: string,
    opts?: { limit?: number }
  ): Promise<CommitTree>;
  revert(
    appDir: string,
    commitId: string,
    opts?: { message?: string }
  ): Promise<{ commitId: string }>;
  resetTo(
    appDir: string,
    commitId: string,
    opts?: { createBackupRef?: boolean }
  ): Promise<{ backupRef?: string }>;
};

export type RuntimePort = {
  listApps(): Promise<AppSummary[]>;
  getApp(
    id: string
  ): Promise<(AppSummary & { permissions: string[] }) | null>;
  mount(id: string, target: MountTarget): Promise<void>;
  unmount(id: string): Promise<void>;
  listThemes(): Promise<{ id: string; label: string }[]>;
  getTheme(): Promise<string>;
  setTheme(themeId: string): Promise<void>;
  registerAppFromFiles(
    appId: string,
    files: Record<string, string>
  ): Promise<void>;
  removeApp(appId: string): Promise<void>;
  listCapabilities(): Promise<CapabilityDescriptor[]>;
  historyCommit(
    appId: string,
    message: string
  ): Promise<{ commitId: string }>;
  historyList(
    appId: string,
    opts?: { limit?: number }
  ): Promise<CommitTree>;
  historyRevert(
    appId: string,
    commitId: string,
    opts?: { message?: string }
  ): Promise<{ commitId: string }>;
  historyResetTo(
    appId: string,
    commitId: string,
    opts?: { createBackupRef?: boolean }
  ): Promise<{ backupRef?: string }>;
  openTab(appId: string, opts?: { title?: string }): Promise<AppTab>;
  closeTab(tabId: string): Promise<void>;
  listTabs(): Promise<AppTab[]>;
  focusTab(tabId: string): Promise<void>;
  getActiveTab(): Promise<AppTab | null>;
};

export type Manifest = {
  id: string;
  name: string;
  version: string;
  entry: string;
  description?: string;
  permissions: string[];
  theme?: { followsHost?: boolean };
};

export function parseManifest(raw: string): Manifest {
  const m = JSON.parse(raw) as Manifest;
  if (!m.id || !m.name || !m.version || !m.entry) {
    throw new Error("INVALID_MANIFEST");
  }
  if (!Array.isArray(m.permissions)) {
    m.permissions = [];
  }
  return m;
}
