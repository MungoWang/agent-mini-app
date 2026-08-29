/**
 * MiniAppAdapter —— 宿主能力接缝（core 与宿主的唯一耦合点）。
 *
 * core（panel-core）不含任何宿主假设：组件/主题/store/默认行为全在这。
 * 宿主实现 MiniAppAdapter 后调 createMiniAppPanel(adapter)，即得完整面板。
 * 字段均可选（按能力）——core 根据能力渲染对应按钮/行为。
 */
import type { AppItem } from "./types.js"

export type Palette = { id: string; label: string; swatch: string; tokens?: { light: unknown; dark: unknown } }
export type Commit = { id: string; message: string; time: string; files?: Array<{ path: string; add?: number; del?: number; preview?: string }> }
export type StorageTable = { name: string; size?: number; updatedAt?: string }

export interface MiniAppAdapter {
  /** 数据源：应用列表 */
  listApps(): Promise<AppItem[]>
  /** iframe / app 内容提供（宿主决定怎么渲染） */
  frame: {
    url(appId: string): string
    mount(appId: string): void
    unmount(appId: string): void
    reload(appId: string): void
  }
  /** 面板显示（dsh=dock 动画；桌面=窗口/面板） */
  openPanel(): void
  closePanel(): void
  /** 自定义主题（可选） */
  palettes?(): Promise<Palette[]>
  /** 主题持久化（可选） */
  persistTheme?(theme: string, palette: string): void
  /** 每 app 主题（可选） */
  appTheme?: { save(appId: string, t: { theme: string; palette: string }): Promise<void>; clear(appId: string): Promise<void> }
  /** 配置表单（可选） */
  config?: { load(): Promise<Record<string, string>>; save(cfg: Record<string, string>): Promise<void> }
  /** 历史（可选，有才显示按钮） */
  history?: { list(appId: string): Promise<Commit[]>; detail(appId: string, id: string): Promise<Commit> }
  /** 存储（可选，有才显示按钮） */
  storage?: { listTables(appId: string): Promise<StorageTable[]>; readTable(appId: string, name: string): Promise<unknown> }
  /** 外部打开请求（dsh=mini_app_open；桌面=命令） */
  onOpenRequest?(cb: (appId?: string) => void): () => void
  /** 空态文案（可选，默认通用） */
  emptyText?: string
  /** 删除 app（可选，默认仅关 tab） */
  deleteApp?(appId: string): Promise<void>
}

export type PanelCapabilities = {
  history: boolean
  storage: boolean
  config: boolean
  appTheme: boolean
  customPalettes: boolean
}

export function capabilitiesOf(adapter: MiniAppAdapter): PanelCapabilities {
  return {
    history: !!adapter.history,
    storage: !!adapter.storage,
    config: !!adapter.config,
    appTheme: !!adapter.appTheme,
    customPalettes: !!adapter.palettes,
  }
}
