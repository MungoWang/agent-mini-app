import type { ReactNode } from "react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

/**
 * App frame: optional sidebar + header + main.
 * @when Root layout for a mini-app page
 * @example
 * <AppShell sidebar={<nav />} header={<PageHeader title="Home" />}>
 *   {children}
 * </AppShell>
 */
export function AppShell({
  sidebar,
  header,
  children,
  className,
}: {
  sidebar?: ReactNode
  header?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-svh w-full", className)} data-testid="app-shell">
      {sidebar ? (
        <aside className="w-56 shrink-0 border-r bg-sidebar p-3">{sidebar}</aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {header ? (
          <header className="border-b px-4 py-3">{header}</header>
        ) : null}
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
