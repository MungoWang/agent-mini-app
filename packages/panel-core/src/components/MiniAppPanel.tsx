import { usePanelState } from "../store.js"
import { Tabs } from "./Tabs.js"
import { Toolbar } from "./Toolbar.js"
import { ListRegion } from "./AppList.js"
import { Settings } from "./Settings.js"
import { Browse } from "./Browse.js"
import { Modal } from "./Modal.js"

/** 根组件：宿主在容器上渲染 <MiniAppPanel actions={...}/> */
export function MiniAppPanel() {
  const s = usePanelState()
  const listVisible = s.active === "all"
  return (
    <>
      <div className="mma-chrome">
        <Tabs />
        <Toolbar />
      </div>
      <div className="mma-stage">
        {listVisible ? <ListRegion /> : null}
        {/* iframe 舞台：由宿主业务逻辑向此容器 append iframe（React 不接管子节点） */}
        <div id="mma-frames" className="mma-frames" style={{ display: listVisible ? "none" : "block" }} />
      </div>
      <Settings />
      <Browse />
      <Modal />
    </>
  )
}
