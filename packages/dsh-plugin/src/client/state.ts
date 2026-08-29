// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
import { setPanelState as MMA_PUSH, getPanelState as MMA_GET, subscribePanel as MMA_SUB } from "@monkey-mini-app/panel-core";
/** dsh-plugin client 模块：宿主状态 + core store 桥（零业务依赖）。
 *  HOST = 可变宿主状态（ESM import 只读，故收敛为对象）；
 *  state/browseState = 宿主面板数据视图（core store 的宿主镜像）。 */
export { MMA_PUSH, MMA_GET, MMA_SUB };

export var MMA_HOST = {
  APPS_HOST: (function () {
    try {
      return localStorage.getItem("mma-apps-host") || "http://127.0.0.1:17880";
    } catch (_) {
      return "http://127.0.0.1:17880";
    }
  })(),
  currentCfg: null,
  _animTimer: 0,
  _visTimer: 0,
  _closing: false,
  _layoutLockUntil: 0,
  _bound: false,
  _sideObs: null,
  _followRaf: 0,
  _pendingBusy: false,
  _lastDock: null,
  _dockSubscribed: false,
};

export function setAppsHost(url) {
  MMA_HOST.APPS_HOST = String(url || MMA_HOST.APPS_HOST);
  try {
    localStorage.setItem("mma-apps-host", MMA_HOST.APPS_HOST);
  } catch (_) {}
}

/* 卡片方案 monogram：host 端已算好 acronym（manifest 优先，否则按中文名拼音声母）。 */
export var MMA_STATE = {
  tabs: [{ id: "all", title: "全部", kind: "all" }],
  active: "all",
  apps: [],
  error: null,
  loading: false,
  query: "",
  dock: (function () {
    try {
      return localStorage.getItem("mma-dock") || "fill";
    } catch (_) {
      return "fill";
    }
  })(),
  theme: "light",
  palette: "default",
  themeScope: (function () {
    try {
      return localStorage.getItem("mma-theme-scope") === "app" ? "app" : "global";
    } catch (_) {
      return "global";
    }
  })(),
  customPalettes: {},
  cardStyle: (function () {
    try {
      const v = localStorage.getItem("mma-card-style");
      return v === "hero" || v === "etch" ? v : "stamp";
    } catch (_) {
      return "stamp";
    }
  })(),
  visible: false,
  pendingDelete: null,
  themePopOpen: false,
  settingsOpen: false,
  cfgMsg: "",
};

export var MMA_BROWSE = {
  open: false,
  kind: "history",
  appId: null,
  appName: "",
  loading: false,
  error: null,
  list: [],
  detail: null, // commit 详情
  table: null, // storage table 名
  tableValue: null,
  openFile: null, // 当前展开 preview 的文件路径
};

/* —— 数据层计算（纯函数，能力层复用） —— */

/** palette 规范化：自定义主题 id 保留，内置 id 走 core clamp。 */
export function normalizePalette(v) {
  if (v && MMA_STATE.customPalettes[v]) return v;
  return clampPalette(v);
}

/** app 主题覆盖（theme.json，默认 null → 跟随全局）。 */
export function appThemeOf(appId) {
  var a = MMA_STATE.apps.find(function (x) {
    return x.id === appId;
  });
  return (a && a.theme) || null;
}

/** app 渲染环境（主题 + palette）。 */
export function envForApp(appId) {
  var t = appThemeOf(appId);
  return {
    theme: t && t.theme ? t.theme : MMA_STATE.theme,
    palette: t && t.palette ? normalizePalette(t.palette) : MMA_STATE.palette,
  };
}

/** 宿主状态 → core store（能力层改状态后统一调用；副作用由 subscribePanel 广播）。 */
export function syncHostState() {
  MMA_PUSH({
    ...MMA_STATE,
    themePopOpen: MMA_STATE.themePopOpen,
    settingsOpen: MMA_STATE.settingsOpen,
    browseOpen: MMA_BROWSE.open,
    browseKind: MMA_BROWSE.kind,
    browseAppId: MMA_BROWSE.appId,
    browseAppName: MMA_BROWSE.appName,
    browseLoading: MMA_BROWSE.loading,
    browseError: MMA_BROWSE.error,
    browseList: MMA_BROWSE.list,
    browseDetail: MMA_BROWSE.detail,
    browseTable: MMA_BROWSE.table,
    browseTableValue: MMA_BROWSE.tableValue,
    browseOpenFile: MMA_BROWSE.openFile,
    pendingDelete: MMA_STATE.pendingDelete ? String(MMA_STATE.pendingDelete.id || MMA_STATE.pendingDelete) : null,
    cfgVersion: MMA_STATE.cfgVersion,
    cfg: MMA_HOST.currentCfg || {},
  });
}
