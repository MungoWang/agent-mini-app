import { RefreshCw, LayoutGrid, Clock, Database, Settings, PanelRight, X } from "lucide-react"
import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"
import { ThemePop } from "./ThemePop.js"

/**
 * 工具栏（单排紧凑，lucide 原版图标 16px / stroke 2）：
 *  删除 → 刷新 → 主题 → 历史 → 存储 → 设置 → 分栏 → 关闭
 */
const iconProps = { size: 16, strokeWidth: 2, className: "mma-ico" }

export function Toolbar() {
  const s = usePanelState()
  const actions = usePanelActions()
  const side = s.dock === "side"
  const appTab = s.tabs.some((t) => t.id === s.active && t.kind === "app")
  const anyApp = s.tabs.some((t) => t.kind === "app")
  return (
    <div className="mma-toolbar">
      {appTab ? (
        <button type="button" className="mma-textbtn danger" id="mma-delete" title="删除" onClick={() => actions.askDelete()}>
          删除
        </button>
      ) : null}
      {appTab ? (
        <button type="button" className="mma-iconbtn" id="mma-reload" title="重新加载" aria-label="重新加载" onClick={() => actions.reloadActive()}>
          <RefreshCw {...iconProps} />
        </button>
      ) : null}
      <div className="mma-theme-wrap" id="mma-theme-wrap">
        <button type="button" className="mma-iconbtn" id="mma-theme-btn" title="主题" aria-label="主题" aria-haspopup="menu" onClick={() => actions.toggleThemePop()}>
          <LayoutGrid {...iconProps} />
        </button>
        <ThemePop />
      </div>
      {anyApp ? (
        <button type="button" className="mma-iconbtn" id="mma-history-btn" title="提交历史" aria-label="提交历史" onClick={() => actions.toggleBrowse("history")}>
          <Clock {...iconProps} />
        </button>
      ) : null}
      {anyApp ? (
        <button type="button" className="mma-iconbtn" id="mma-storage-btn" title="存储" aria-label="存储" onClick={() => actions.toggleBrowse("storage")}>
          <Database {...iconProps} />
        </button>
      ) : null}
      <button type="button" className="mma-iconbtn" id="mma-settings-btn" title="设置" aria-label="设置" onClick={() => actions.toggleSettings(true)}>
        <Settings {...iconProps} />
      </button>
      <button
        type="button"
        className="mma-iconbtn"
        id="mma-dock-host"
        title={side ? "铺满主区" : "钉到聊天右侧"}
        aria-label={side ? "铺满主区" : "钉到聊天右侧"}
        onClick={() => actions.setDock(side ? "fill" : "side")}
      >
        <PanelRight {...iconProps} />
      </button>
      <button type="button" className="mma-iconbtn" id="mma-close-host" title="关闭" aria-label="关闭" onClick={() => actions.closeDashboard()}>
        <X {...iconProps} />
      </button>
    </div>
  )
}
