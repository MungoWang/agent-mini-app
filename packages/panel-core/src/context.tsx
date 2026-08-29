/** Actions Context：宿主实现 MiniAppActions 注入，组件 usePanelActions 消费。
 *  替代旧版 window.__mma 全局桥 —— 类型安全 + 可跨项目复用。 */
import * as React from "react"
import type { MiniAppActions } from "./types.js"

const MiniAppActionsContext = React.createContext<MiniAppActions | null>(null)

export function MiniAppActionsProvider({
  actions,
  children,
}: {
  actions: MiniAppActions
  children: React.ReactNode
}) {
  return <MiniAppActionsContext.Provider value={actions}>{children}</MiniAppActionsContext.Provider>
}

export function usePanelActions(): MiniAppActions {
  const ctx = React.useContext(MiniAppActionsContext)
  if (!ctx) throw new Error("usePanelActions must be used inside <MiniAppActionsProvider>")
  return ctx
}
