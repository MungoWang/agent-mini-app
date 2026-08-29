import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"

export function Modal() {
  const s = usePanelState()
  const actions = usePanelActions()
  if (!s.pendingDelete) return null
  const app = s.apps.find((a) => a.id === s.pendingDelete) || { id: s.pendingDelete, name: s.pendingDelete }
  return (
    <div className="mma-modal" id="mma-modal">
      <div className="mma-dialog">
        <h3>删除小程序</h3>
        <p>将删除「{app.name || app.id}」及其本地数据，无法撤销。</p>
        <div className="mma-dialog-actions">
          <button type="button" id="mma-dialog-cancel" onClick={() => actions.hideModal()}>
            取消
          </button>
          <button type="button" id="mma-dialog-ok" className="go" onClick={() => actions.confirmDelete()}>
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
