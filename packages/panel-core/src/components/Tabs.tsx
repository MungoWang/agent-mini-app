import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"

export function Tabs() {
  const s = usePanelState()
  const actions = usePanelActions()
  return (
    <div className="mma-tabs" id="mma-tabs">
      {s.tabs.map((tb) => {
        const active = tb.id === s.active
        const close =
          tb.id === "all" ? null : (
            <span
              className="mma-tab-x"
              role="button"
              aria-label={"关闭 " + tb.title}
              onClick={(e) => {
                e.stopPropagation()
                actions.closeTab(tb.id)
              }}
            >
              ×
            </span>
          )
        return (
          <button
            key={tb.id}
            type="button"
            className="mma-tab"
            data-active={active ? "1" : "0"}
            title={tb.id === "all" ? "全部小程序" : tb.title}
            onClick={() => actions.switchTab(tb.id)}
          >
            <span>{tb.title}</span>
            {close}
          </button>
        )
      })}
    </div>
  )
}
