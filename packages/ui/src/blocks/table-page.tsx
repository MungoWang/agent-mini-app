"use client";

import type { ReactNode } from "react";

import { cn } from "@monkey-mini-app/ui/lib/utils";

export type TablePageProps = {
  /** Page-level actions above the table: search, filters, "New". Pinned; it never scrolls away. */
  toolbar?: ReactNode;
  /** The table itself (a `DataGrid`, usually). The only slot that scrolls. */
  grid?: ReactNode;
  /** First-run / no-match placeholder. Renders when `grid` is not given. */
  empty?: ReactNode;
  /** A pager you own. `DataGrid` already renders its own when `features.pagination` is on. */
  pagination?: ReactNode;
  /** Bulk actions. Floats over the bottom of the grid instead of pushing the rows around. */
  bulk?: ReactNode;
  className?: string;
};

/**
 * Full-height table page: toolbar pinned, one scrolling band for the grid, bulk bar floating.
 *
 * Without it a `DataGrid` is dropped into a plain flex column, the tallest child wins, and the
 * page scrolls instead of the table: the toolbar slides off, pagination ends up below the fold,
 * and selecting 200 rows shoves the table down every time the bulk bar appears. The band owns
 * `min-h-0` + `overflow-y-auto` here, and the bulk bar is out of flow with `pointer-events-none`
 * on its track so the rows under it stay clickable.
 *
 * @when Page shape: one wide filterable table is the product — inventories, ledgers, saved views
 * @example
 * <TablePage
 *   toolbar={<FilterBar {...{ query, onQueryChange, filters }} />}
 *   grid={rows.length ? <DataGrid columns={columns} data={rows} /> : undefined}
 *   empty={<FirstRun onImport={import} />}
 *   bulk={selected.size ? <BulkBar count={selected.size} onClear={clear} /> : undefined}
 * />
 * @family Layout & structure
 */
export function TablePage({
  toolbar,
  grid,
  empty,
  pagination,
  bulk,
  className,
}: TablePageProps) {
  return (
    <div
      className={cn("relative flex h-full min-h-0 w-full flex-col", className)}
      data-testid="table-page"
    >
      {toolbar ? (
        <div className="shrink-0" data-testid="table-page-toolbar">
          {toolbar}
        </div>
      ) : null}

      {/* The one scroller. `grid ?? empty` keeps "no rows" the app's decision, not a prop. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="table-page-grid"
      >
        {grid ?? empty ?? null}
      </div>

      {pagination ? (
        <div className="shrink-0" data-testid="table-page-pagination">
          {pagination}
        </div>
      ) : null}

      {bulk ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4"
          data-testid="table-page-bulk"
        >
          <div className="pointer-events-auto">{bulk}</div>
        </div>
      ) : null}
    </div>
  );
}
