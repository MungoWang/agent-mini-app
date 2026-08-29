/** 便捷组合：Provider + 面板一体（宿主一行接入） */
import * as React from "react"
import type { MiniAppActions } from "./types.js"
import { MiniAppActionsProvider } from "./context.js"
import { MiniAppPanel } from "./components/MiniAppPanel.js"

export function PanelHost({ actions, className, style }: { actions: MiniAppActions; className?: string; style?: React.CSSProperties }) {
  return (
    <MiniAppActionsProvider actions={actions}>
      <div className={className} style={style}>
        <MiniAppPanel />
      </div>
    </MiniAppActionsProvider>
  )
}
