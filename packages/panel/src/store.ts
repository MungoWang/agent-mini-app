/** Panel external store: useSyncExternalStore. One instance per host; tests call resetPanelState. */
import { useSyncExternalStore } from "react";

import type { PanelState } from "./types.ts";

const none: PanelState["capabilities"] = {
  history: false,
  storage: false,
  config: false,
  appTheme: false,
  customPalettes: false,
  deleteApp: false,
};

const initial: PanelState = {
  tabs: [{ id: "all", title: "全部", kind: "all" }],
  active: "all",
  apps: [],
  error: null,
  loading: false,
  query: "",
  dock: "fill",
  theme: "light",
  palette: "default",
  themeScope: "global",
  customPalettes: {},
  cardStyle: "stamp",
  visible: false,
  pendingDelete: null,
  themePopOpen: false,
  settingsOpen: false,
  cfgMsg: "",
  cfgVersion: 0,
  cfg: {},
  emptyText: undefined,
  capabilities: none,
  locale: "zh-CN",
  browseOpen: false,
  browseKind: "history",
  browseAppId: null,
  browseAppName: "",
  browseLoading: false,
  browseError: null,
  browseList: [],
  browseDetail: null,
  browseTable: null,
  browseTableValue: null,
  browseOpenFile: null,
};

let state: PanelState = { ...initial, capabilities: { ...none } };
const listeners = new Set<() => void>();

export function getPanelState(): PanelState {
  return state;
}

export function setPanelState(patch: Partial<PanelState>): PanelState {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
  return state;
}

export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPanelState(seed?: Partial<PanelState>): PanelState {
  state = {
    ...initial,
    capabilities: { ...none },
    customPalettes: {},
    cfg: {},
    tabs: [{ id: "all", title: "全部", kind: "all" }],
    ...(seed || {}),
  };
  for (const fn of listeners) fn();
  return state;
}

export function usePanelState(): PanelState {
  return useSyncExternalStore(subscribePanel, getPanelState);
}
