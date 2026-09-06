"use client";

import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@monkey-mini-app/ui/components/resizable";
import { useIsMobile } from "@monkey-mini-app/ui/hooks/use-mobile";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type ListDetailProps = {
  /** The collection pane: list, table, board — anything you scroll through. */
  list: ReactNode;
  /** The record pane. Pass `undefined` for "nothing selected" — `empty` renders instead. */
  detail?: ReactNode;
  /** Placeholder for the record pane while nothing is selected. */
  empty?: ReactNode;
  /** Search / filters / create button. Fixed above the panes; it never scrolls. */
  toolbar?: ReactNode;
  /** Narrow screens show one pane at a time. The app owns which one. */
  mobileView?: "list" | "detail";
  /** Renders a back control on the record pane below `md`. No-op on wide screens. */
  onMobileBack?: () => void;
  /** Collection pane share of the width, 0-100. Default 34. */
  defaultSize?: number;
  /** Collection pane floor, so a long record title cannot push it away. Default 18. */
  minSize?: number;
  className?: string;
};

/** One scroll container per pane, and nothing above it that also scrolls. */
const PANE = "h-full min-h-0 w-full overflow-y-auto";

/**
 * Two-pane record browser: the list holds its place while the selected record scrolls on its own.
 *
 * This is the shape agents get wrong without help — a flex child with no `min-h-0` grows to fit
 * its content, so the whole page scrolls, the toolbar slides away, and the two panes are never
 * independent. Both panes scroll here by construction, and the record pane collapses to a
 * full-width view below `md` instead of squashing.
 *
 * @when Page shape: click a row, then read or edit that one record beside the list — orders, tickets, contacts, log lines
 * @example
 * <ListDetail
 *   toolbar={<SearchInput />}
 *   list={<OrderList />}
 *   detail={order ? <OrderCard order={order} /> : undefined}
 *   empty={<div>Pick an order</div>}
 *   mobileView={order ? "detail" : "list"}
 *   onMobileBack={() => setOrder(null)}
 * />
 * @family Layout & structure
 */
export function ListDetail({
  list,
  detail,
  empty,
  toolbar,
  mobileView = "list",
  onMobileBack,
  defaultSize = 34,
  minSize = 18,
  className,
}: ListDetailProps) {
  const isMobile = useIsMobile();
  const t = useLabels("listDetail");

  const listPane = (
    <div className={PANE} data-testid="list-detail-list">
      {list}
    </div>
  );

  const detailPane = (
    <div className={PANE} data-testid="list-detail-detail">
      {isMobile && detail && onMobileBack ? (
        <button
          type="button"
          onClick={onMobileBack}
          className="text-muted-foreground -mb-2 px-4 pt-3 pb-1 text-sm underline-offset-4 hover:underline"
          data-testid="list-detail-back"
        >
          {t.back}
        </button>
      ) : null}
      {detail ?? empty ?? null}
    </div>
  );

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      data-testid="list-detail"
    >
      {toolbar ? (
        <div className="shrink-0" data-testid="list-detail-toolbar">
          {toolbar}
        </div>
      ) : null}

      {isMobile ? (
        <div className="min-h-0 flex-1">
          {mobileView === "detail" ? detailPane : listPane}
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={defaultSize} minSize={minSize}>
            {listPane}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={100 - defaultSize} minSize={30}>
            {detailPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
