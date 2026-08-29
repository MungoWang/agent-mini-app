/** createMiniAppPanel —— 宿主一行接入：给 adapter，出面板。 */
import { createRoot, type Root } from "react-dom/client"
import { injectPanelCss } from "./styles.js"
import { MiniAppActionsProvider } from "./context.js"
import { MiniAppPanel } from "./components/MiniAppPanel.js"
import { createPanelActions } from "./actions.js"
import type { MiniAppActions } from "./types.js"
import type { MiniAppAdapter } from "./adapter.js"

export interface PanelInstance {
  actions: MiniAppActions
  /** 挂载到宿主元素（宿主负责 createRoot 容器） */
  mount(el: HTMLElement): void
  unmount(): void
  /** 面板生命周期入口（宿主入口按钮/命令调）——转调 adapter.openPanel/closePanel */
  open(): void
  close(): void
}

export function createMiniAppPanel(adapter: MiniAppAdapter): PanelInstance {
  let rootEl: HTMLElement | null = null
  let root: Root | null = null
  const actions = createPanelActions(adapter, () => rootEl)
  return {
    actions,
    open: () => adapter.openPanel(),
    close: () => adapter.closePanel(),
    mount(el: HTMLElement) {
      rootEl = el
      injectPanelCss()
      if (!root) root = createRoot(el)
      root.render(
        <MiniAppActionsProvider actions={actions}>
          <MiniAppPanel />
        </MiniAppActionsProvider>
      )
    },
    unmount() {
      if (root) {
        root.unmount()
        root = null
      }
      rootEl = null
    },
  }
}
