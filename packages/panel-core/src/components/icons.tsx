/** 线框图标集（24×24 lucide 标准路径，统一 strokeWidth 1.6，等克重）。
 *  来源语义对齐 lucide-react：refresh-cw / layout-grid / clock / database /
 *  settings / panel-left / x。零依赖内联。 */
import * as React from "react"

type IconProps = { size?: number }

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.9 }}
    >
      {children}
    </svg>
  )
}

/** 刷新 ↻（lucide refresh-cw） */
export function IconRefresh({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l.73-1.19" />
    </Svg>
  )
}

/** 主题 ⊞ 四方格（lucide layout-grid） */
export function IconTheme({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.8" />
    </Svg>
  )
}

/** 历史 🕒（lucide clock） */
export function IconHistory({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  )
}

/** 存储/数据库（lucide database，修正高宽比：rx5 ry2.5 + 高 14，饱满不塌陷） */
export function IconStorage({ size }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="12" cy="5" rx="6" ry="2.5" />
      <path d="M6 12c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5" />
      <path d="M6 5v14c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V5" />
    </Svg>
  )
}

/** 设置 ⚙️（lucide settings，经典 8 齿连续块状齿轮） */
export function IconSettings({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

/** 分栏（lucide panel-left） */
export function IconDock({ right, size }: { right: boolean; size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1={right ? "15" : "9"} y1="3" x2={right ? "15" : "9"} y2="21" />
    </Svg>
  )
}

/** 关闭 ✕（lucide x，最右边界） */
export function IconClose({ size }: IconProps) {
  return (
    <Svg size={size}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}
