// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 模块：core store ↔ 宿主副作用桥。
 *  依赖方向：state ← {layout, theme, frame} ← bridge（无环）。
 *  职责：subscribePanel 单点广播宿主副作用（主题注入/布局/iframe env/侧栏态）；
 *  Escape 处理（hideThemePop/hideModal）。 */
import { MMA_HOST, MMA_STATE, MMA_PUSH, MMA_GET, MMA_SUB } from "./state.js";
import { layoutBox, setDockPad, syncHostToSidebar, markFooter } from "./layout.js";
import { postEnvToFrames } from "./frame.js";
import { applyPanelTheme } from "./theme.js";

let _sideEffectsSubscribed = false;

/** 宿主副作用单点调度：core store 变化 → 反向同步宿主视图 + 广播副作用。 */
export function subscribeHostSideEffects() {
  if (_sideEffectsSubscribed) return;
  _sideEffectsSubscribed = true;
  MMA_SUB(function () {
    const st = MMA_GET();
    // 反向同步：core store 是权威（UI 组件改 theme/palette/dock 等走 core actions）
    if (st.theme) MMA_STATE.theme = st.theme;
    if (st.palette) MMA_STATE.palette = st.palette;
    // tabs/active/apps 由 core 管理（openAppTab/switchTab）——宿主视图需跟随（reloadActive/activeApp 读它）
    if (Array.isArray(st.tabs) && st.tabs.length) MMA_STATE.tabs = st.tabs;
    if (st.active) MMA_STATE.active = st.active;
    if (Array.isArray(st.apps)) MMA_STATE.apps = st.apps;
    applyPanelTheme();
    if (!MMA_HOST._closing) syncHostToSidebar(false);
    markFooter(MMA_STATE.visible);
    postEnvToFrames();
  });
}

let _dockSubscribed = false;

/** dock 变化 → 宿主布局动画（side/fill 切换 + 侧栏 pad + 持久化跟随）。 */
export function subscribeDockLayout() {
  if (_dockSubscribed) return;
  _dockSubscribed = true;
  MMA_SUB(function () {
    const dock = MMA_GET().dock;
    if (dock === MMA_HOST._lastDock) return;
    MMA_HOST._lastDock = dock;
    // 同步宿主视图（layoutBox/syncHostToSidebar 等布局函数读 MMA_STATE.dock）
    MMA_STATE.dock = dock;
    const host = document.getElementById("mma-host");
    if (host) host.setAttribute("data-dock", dock);
    if (!MMA_HOST._closing) {
      syncHostToSidebar(true);
      setDockPad(dock === "side");
    }
  });
}

/** Escape：优先关主题 pop，其次关删除模态。 */
export function hideThemePop(): boolean {
  const open = MMA_GET().themePopOpen;
  if (!open) return false;
  MMA_PUSH({ themePopOpen: false });
  return true;
}

export function hideModal(): void {
  MMA_PUSH({ pendingDelete: null });
}
