import type { ReactNode } from "react"

export type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * Page title row with optional description and right-side actions.
 * @when Top of a page inside AppShell main
 * @example
 * <PageHeader title="QA Runs" description="Last 24h" actions={<Button>New</Button>} />
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3"
      data-testid="page-header"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading text-xl font-medium">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
