import * as React from "react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

export function AvatarGroup({
  children,
  className,
  max = 3,
}: {
  children: React.ReactNode
  className?: string
  max?: number
}) {
  const items = React.Children.toArray(children).slice(0, max)
  return <div className={cn("flex items-center -space-x-2", className)}>{items}</div>
}
