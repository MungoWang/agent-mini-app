"use client";

import type { ReactNode } from "react";

import { useIsMobile } from "@monkey-mini-app/ui/hooks/use-mobile";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type DashboardShellProps = {
  /** Title row / `PageHeader`. Pinned: it stays while the content scrolls under it. */
  header?: ReactNode;
  /** KPI strip. Pinned with the header — the point of a dashboard is that the numbers hold. */
  kpis?: ReactNode;
  /** Charts and tables. The scrolling body. */
  main: ReactNode;
  /** Activity feed / top offenders. Sits beside `main` on wide screens, stacks under it when narrow. */
  aside?: ReactNode;
  /** Aside width in px on wide screens. Default 320. */
  asideWidth?: number;
  className?: string;
};

/**
 * Overview page with a pinned header + KPI strip and exactly one scrolling body.
 *
 * The failure this exists for: the page is a plain column, `overflow-auto` ends up on the
 * outermost div, and the first chart the user scrolls past takes the header and the KPI row
 * with it — a dashboard whose numbers scroll away is not a dashboard. The aside gets its own
 * scroller when there is room for two, and folds under `main` into the single body scroller
 * when there is not, rather than becoming a third half-height pane.
 *
 * @when Page shape: metrics up top, charts below, optional activity rail — ops overviews, monitor walls
 * @example
 * <DashboardShell
 *   header={<PageHeader title="值班" description="每 5 秒" />}
 *   kpis={<div className="grid grid-cols-4 gap-3">{cards}</div>}
 *   main={<Charts />}
 *   aside={<ActivityFeed items={items} />}
 * />
 * @family Layout & structure
 */
export function DashboardShell({
  header,
  kpis,
  main,
  aside,
  asideWidth = 320,
  className,
}: DashboardShellProps) {
  const isNarrow = useIsMobile();

  const pinned = (
    <>
      {header ? (
        <div className="shrink-0" data-testid="dashboard-header">
          {header}
        </div>
      ) : null}
      {kpis ? (
        <div className="shrink-0" data-testid="dashboard-kpis">
          {kpis}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      data-testid="dashboard-shell"
    >
      {pinned}

      {aside && !isNarrow ? (
        // Room for two panes: each scrolls on its own, neither can push the other.
        <div className="flex min-h-0 flex-1" data-testid="dashboard-body">
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            data-testid="dashboard-main"
          >
            {main}
          </div>
          <div
            className="border-border bg-muted/30 min-h-0 shrink-0 overflow-y-auto border-l"
            data-testid="dashboard-aside"
            style={{ width: asideWidth }}
          >
            {aside}
          </div>
        </div>
      ) : (
        // One body scroller; the aside folds to the bottom of it instead of a squeezed pane.
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          data-testid="dashboard-body"
        >
          <div data-testid="dashboard-main">{main}</div>
          {aside ? (
            <div
              className="border-border border-t px-4 py-4"
              data-testid="dashboard-aside"
            >
              {aside}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
