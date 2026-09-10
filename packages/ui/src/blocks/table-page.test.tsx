import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TablePage } from "./table-page";

/**
 * These tests assert the *scroll contract*, not markup. A preset whose height chain is
 * untested gets "cleaned up" by the next agent straight back into the bug it was written
 * to kill (whole page scrolls, toolbar slides away, bulk bar reflows the rows).
 */
describe("TablePage", () => {
  it("puts the only scroller on the grid band", () => {
    render(
      <div style={{ height: 400 }}>
        <TablePage
          toolbar={<p>filters</p>}
          grid={<p>table</p>}
          pagination={<p>pager</p>}
        />
      </div>,
    );

    const band = screen.getByTestId("table-page-grid");
    expect(band).toHaveClass("overflow-y-auto");
    expect(band).toHaveClass("min-h-0", "flex-1");

    // Nothing above or below may also scroll, and nothing pinned may be squeezable away.
    const root = screen.getByTestId("table-page");
    expect(root).toHaveClass("h-full", "min-h-0");
    expect(root).not.toHaveClass("overflow-y-auto");
    for (const slot of ["table-page-toolbar", "table-page-pagination"]) {
      expect(screen.getByTestId(slot)).toHaveClass("shrink-0");
    }
  });

  it("floats the bulk bar over the rows instead of reflowing them", () => {
    const { unmount } = render(
      <TablePage
        grid={<p>table</p>}
        bulk={<button type="button">12 selected</button>}
      />,
    );

    const track = screen.getByTestId("table-page-bulk");
    expect(track).toHaveClass("absolute", "inset-x-0", "bottom-0");
    // The track spans the full width, so it must not swallow clicks on the rows beneath it…
    expect(track).toHaveClass("pointer-events-none");
    // …while the bar itself stays interactive.
    expect(track.firstElementChild).toHaveClass("pointer-events-auto");

    unmount();
    render(<TablePage grid={<p>table</p>} />);
    expect(screen.queryByTestId("table-page-bulk")).toBeNull();
  });

  it("renders the placeholder when the app withholds the grid", () => {
    render(<TablePage empty={<p>nothing imported yet</p>} />);
    expect(screen.getByText("nothing imported yet")).toBeTruthy();
    expect(screen.queryByText("table")).toBeNull();
    // An absent slot renders no wrapper at all — no empty bordered strip above the table.
    expect(screen.queryByTestId("table-page-toolbar")).toBeNull();
  });
});
