"use client"

import * as React from "react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

/**
 * Accessible field label.
 * @when Always bind `htmlFor` — bare text labels are not accessible.
 * @example
 * <Label htmlFor="name">名称</Label>
 * @family Form
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
