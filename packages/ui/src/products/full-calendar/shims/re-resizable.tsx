import type { ReactNode } from "react"

export type ResizeCallback = (
  _event: unknown,
  direction: string,
  ref: { style: { height: string } },
) => void

export function Resizable({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
  minHeight?: number
  maxHeight?: number
  enable?: unknown
  handleStyles?: unknown
  handleClasses?: unknown
  onResizeStart?: unknown
  onResize?: unknown
  onResizeStop?: unknown
}) {
  return <div className={className}>{children}</div>
}
