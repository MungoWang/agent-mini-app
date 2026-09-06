import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListDetail } from "./list-detail";

/**
 * `useIsMobile` reads `matchMedia` on mount and `window.innerWidth` for the value; jsdom
 * provides neither, so the stub below is the only honest way to drive the breakpoint.
 */
function setViewport(width: number): void {
  const isNarrow = width < 768;
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isNarrow,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ListDetail", () => {
  it("gives every pane its own scroll container at a fixed height", () => {
    setViewport(1200);
    render(
      <div style={{ height: 400 }}>
        <ListDetail
          list={<ul>rows</ul>}
          detail={<p>one record</p>}
          toolbar={<p>filters</p>}
        />
      </div>,
    );

    for (const pane of ["list-detail-list", "list-detail-detail"]) {
      const el = screen.getByTestId(pane);
      // Both halves of the contract: it scrolls, and a flex parent cannot force it to grow.
      expect(el).toHaveClass("overflow-y-auto");
      expect(el).toHaveClass("min-h-0");
      expect(el).toHaveClass("h-full");
    }

    // Nothing above the panes may scroll as well, or the page scrolls instead of the panes.
    const root = screen.getByTestId("list-detail");
    expect(root).toHaveClass("h-full", "min-h-0");
    expect(root).not.toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("list-detail-toolbar")).toHaveClass("shrink-0");
    // react-resizable-panels owns the group element, so assert through its own slot marker.
    const group = document.querySelector('[data-slot="resizable-panel-group"]');
    expect(group).not.toBeNull();
    expect(group!.className).toContain("min-h-0");
    expect(group!.className).toContain("flex-1");
  });

  it("shows both panes side by side on a wide screen", () => {
    setViewport(1200);
    render(<ListDetail list={<ul>rows</ul>} detail={<p>one record</p>} />);
    expect(screen.getByTestId("list-detail-list")).toBeInTheDocument();
    expect(screen.getByTestId("list-detail-detail")).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
    expect(screen.getByText("one record")).toBeInTheDocument();
  });

  it("renders the placeholder in the record pane only while nothing is selected", () => {
    setViewport(1200);
    const { rerender } = render(
      <ListDetail list={<ul>rows</ul>} empty={<p>Pick a row</p>} />,
    );
    expect(screen.getByText("Pick a row")).toBeInTheDocument();

    rerender(
      <ListDetail
        list={<ul>rows</ul>}
        empty={<p>Pick a row</p>}
        detail={<p>Row 7</p>}
      />,
    );
    expect(screen.getByText("Row 7")).toBeInTheDocument();
    expect(screen.queryByText("Pick a row")).not.toBeInTheDocument();
  });

  it("collapses to one pane below md and hands the back control to the app", () => {
    setViewport(420);
    const onMobileBack = vi.fn();
    const { rerender } = render(
      <ListDetail
        list={<ul>rows</ul>}
        detail={<p>one record</p>}
        onMobileBack={onMobileBack}
      />,
    );

    // Default view is the list; the record is not stacked underneath it.
    expect(screen.queryByTestId("list-detail-detail")).not.toBeInTheDocument();

    rerender(
      <ListDetail
        list={<ul>rows</ul>}
        detail={<p>one record</p>}
        mobileView="detail"
        onMobileBack={onMobileBack}
      />,
    );
    expect(screen.getByTestId("list-detail-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("list-detail-list")).not.toBeInTheDocument();
    // No resizer on a phone: collapsing must also drop the drag handle.
    expect(
      document.querySelector('[data-slot="resizable-panel-group"]'),
    ).toBeNull();

    fireEvent.click(screen.getByTestId("list-detail-back"));
    expect(onMobileBack).toHaveBeenCalledTimes(1);
  });

  it("omits the back control when the app cannot go back", () => {
    setViewport(420);
    render(
      <ListDetail
        list={<ul>rows</ul>}
        detail={<p>one record</p>}
        mobileView="detail"
      />,
    );
    expect(screen.queryByTestId("list-detail-back")).not.toBeInTheDocument();
  });
});
