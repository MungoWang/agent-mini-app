import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardShell } from "./dashboard-shell";

/** `useIsMobile` reads `matchMedia`; jsdom gives it nothing, so the breakpoint is stubbed. */
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

describe("DashboardShell", () => {
  it("pins the header and KPI strip and scrolls exactly one body", () => {
    setViewport(1200);
    render(
      <div style={{ height: 400 }}>
        <DashboardShell
          header={<p>title</p>}
          kpis={<p>numbers</p>}
          main={<p>charts</p>}
        />
      </div>,
    );

    for (const slot of ["dashboard-header", "dashboard-kpis"]) {
      const el = screen.getByTestId(slot);
      expect(el).toHaveClass("shrink-0");
      // A pinned slot that scrolls is the same bug wearing a different hat.
      expect(el).not.toHaveClass("overflow-y-auto");
    }
    const root = screen.getByTestId("dashboard-shell");
    expect(root).toHaveClass("h-full", "min-h-0");
    // The classic bug: the outer column scrolls and carries the header off screen.
    expect(root).not.toHaveClass("overflow-y-auto");

    // One scroller only — nested scrollers steal the wheel from each other.
    const body = screen.getByTestId("dashboard-body");
    const main = screen.getByTestId("dashboard-main");
    expect(body).toHaveClass("overflow-y-auto");
    expect(main).not.toHaveClass("overflow-y-auto");
  });

  it("gives the aside its own scroller when there is room for two", () => {
    setViewport(1200);
    render(
      <DashboardShell
        main={<p>charts</p>}
        aside={<p>activity</p>}
        asideWidth={280}
      />,
    );

    const body = screen.getByTestId("dashboard-body");
    const main = screen.getByTestId("dashboard-main");
    const aside = screen.getByTestId("dashboard-aside");
    // Two independent panes: the band they sit in must not scroll, each pane must.
    expect(body).not.toHaveClass("overflow-y-auto");
    expect(main).toHaveClass("overflow-y-auto");
    expect(aside).toHaveClass("overflow-y-auto", "shrink-0");
    expect(aside).toHaveStyle({ width: "280px" });
  });

  it("folds the aside into the single body scroller when the panel is narrow", () => {
    setViewport(420);
    render(<DashboardShell main={<p>charts</p>} aside={<p>activity</p>} />);

    expect(screen.getByTestId("dashboard-body")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("dashboard-main")).not.toHaveClass(
      "overflow-y-auto",
    );
    const aside = screen.getByTestId("dashboard-aside");
    expect(aside).not.toHaveClass("overflow-y-auto");
    // Stacked, so it needs its own top rule rather than the rail's left border.
    expect(aside).toHaveClass("border-t");
  });
});
