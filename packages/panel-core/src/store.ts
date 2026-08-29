/** 面板 external store：useSyncExternalStore 驱动（官方 dsh 同款模式）。
 *  宿主业务逻辑通过 setPanelState 更新；组件 usePanelState 订阅。
 *  单例足够（一个宿主一个面板）；如需多实例可 clone。
 */
import { useSyncExternalStore } from "react"
import type { PanelState } from "./types.js"

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
}

let state: PanelState = initial
const listeners = new Set<() => void>()

export function getPanelState(): PanelState {
  return state
}

export function setPanelState(patch: Partial<PanelState>): PanelState {
  state = { ...state, ...patch }
  for (const fn of listeners) fn()
  return state
}

export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetPanelState(seed?: Partial<PanelState>): PanelState {
  state = { ...initial, ...(seed || {}) }
  for (const fn of listeners) fn()
  return state
}

/** React hook：组件内订阅面板状态 */
export function usePanelState(): PanelState {
  return useSyncExternalStore(subscribePanel, getPanelState)
}
