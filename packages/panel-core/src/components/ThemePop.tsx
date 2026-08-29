import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"
import { PALETTES } from "../themes.js"

/**
 * 主题切换中心（恢复原版结构）：
 *  浅色/深色 seg → 纵向单列 palette 列表（彩色圆点 + 标签 + 自定义 badge）
 *  → 全局/当前应用 scope seg → 清除应用主题
 */
export function ThemePop() {
  const s = usePanelState()
  const actions = usePanelActions()
  const app = actions.getActiveApp()
  const appTheme = app ? (app.theme as { theme?: string; palette?: string } | null) : null
  const customs = (s.customPalettes || {}) as Record<string, { label?: string; swatch?: string }>
  return (
    <div className="mma-pop" id="mma-theme-pop" role="menu" data-open={s.themePopOpen ? "1" : "0"} onClick={(e) => e.stopPropagation()}>
      {/* 浅色/深色 */}
      <div className="mma-pop-seg">
        {["light", "dark"].map((mode) => (
          <button
            key={mode}
            type="button"
            data-mode={mode}
            data-on={s.theme === mode ? "1" : "0"}
            onClick={() => actions.setAppearance({ theme: mode }, s.themeScope)}
          >
            {mode === "light" ? "浅色" : "深色"}
          </button>
        ))}
      </div>
      {/* palette 纵向单列（彩色圆点） */}
      <div className="mma-pop-list">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            className="mma-swatch"
            data-palette={p.id}
            role="menuitem"
            data-on={s.palette === p.id ? "1" : "0"}
            onClick={() => actions.setAppearance({ palette: p.id }, s.themeScope)}
          >
            <i className="mma-dot" style={{ background: p.swatch }} />
            <span>{p.label}</span>
          </button>
        ))}
        {Object.keys(customs).map((id) => (
          <button
            key={id}
            type="button"
            className="mma-swatch"
            data-palette={id}
            data-custom="1"
            role="menuitem"
            data-on={s.palette === id ? "1" : "0"}
            onClick={() => actions.setAppearance({ palette: id }, s.themeScope)}
          >
            <i className="mma-dot" style={{ background: customs[id].swatch || "#888" }} />
            <span>{customs[id].label || id}</span>
            <i className="mma-custom-badge">自定义</i>
          </button>
        ))}
      </div>
      {/* 全局 / 当前应用 */}
      <div className="mma-pop-seg mma-scope-seg">
        <button type="button" data-scope="global" data-on={s.themeScope === "global" ? "1" : "0"} onClick={() => actions.setThemeScope("global")}>
          全局
        </button>
        <button
          type="button"
          data-scope="app"
          id="mma-scope-app"
          title={app ? "保存到「" + app.name + "」" : "打开小程序后可用"}
          data-on={s.themeScope === "app" ? "1" : "0"}
          disabled={!app}
          onClick={() => actions.setThemeScope("app")}
        >
          {app ? app.name : "当前小程序"}
        </button>
      </div>
      {s.themeScope === "app" && appTheme ? (
        <button type="button" className="mma-textbtn" id="mma-clear-app-theme" onClick={() => actions.clearAppTheme()}>
          跟随全局（清除本应用主题）
        </button>
      ) : null}
    </div>
  )
}
