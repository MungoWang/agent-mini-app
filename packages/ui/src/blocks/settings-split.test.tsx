import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsSplit } from "./settings-split";

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

const SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "Name and timezone",
    content: <p>a form</p>,
  },
  { id: "hooks", label: "Webhooks", content: <p>endpoints</p> },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsSplit", () => {
  it("wires every nav link to a section that actually exists", () => {
    setViewport(1200);
    render(<SettingsSplit sections={SECTIONS} />);

    // The quiet failure this preset exists to kill: `href="#hook"` next to `id="hooks"`, and
    // the highlight just never moves. Both sides come from one array now, so assert the pair.
    const nav = screen.getByTestId("settings-split-nav");
    for (const s of SECTIONS) {
      expect(document.getElementById(s.id)).toBeTruthy();
      expect(nav.querySelector(`a[href="#${s.id}"]`)).toBeTruthy();
    }
    expect(nav.querySelectorAll("a")).toHaveLength(SECTIONS.length);
  });

  it("scrolls the nav and the content independently, and pins the footer to the content pane", () => {
    setViewport(1200);
    render(
      <SettingsSplit sections={SECTIONS} footer={<p>Unsaved changes</p>} />,
    );

    const root = screen.getByTestId("settings-split");
    expect(root).toHaveClass("h-full", "min-h-0");
    expect(root).not.toHaveClass("overflow-y-auto");

    const scroller = screen.getByTestId("settings-split-scroll");
    expect(scroller).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");
    expect(screen.getByTestId("settings-split-nav")).toHaveClass(
      "overflow-y-auto",
      "shrink-0",
    );

    // A footer inside the scroller is a footer the user has to scroll to find.
    const footer = screen.getByTestId("settings-split-footer");
    expect(footer).toHaveClass("shrink-0");
    expect(scroller.contains(footer)).toBe(false);
  });

  it("collapses the jump list to a pinned row when the panel is narrow", () => {
    setViewport(420);
    render(<SettingsSplit sections={SECTIONS} />);

    const nav = screen.getByTestId("settings-split-nav");
    expect(nav).toHaveClass("shrink-0", "overflow-x-auto");
    expect(nav).not.toHaveClass("overflow-y-auto");
    // The content pane keeps its own scroller either way.
    expect(screen.getByTestId("settings-split-scroll")).toHaveClass(
      "overflow-y-auto",
    );
  });

  it("renders a section description when the app gives one", () => {
    setViewport(1200);
    render(<SettingsSplit sections={SECTIONS} />);
    expect(screen.getByText("Name and timezone")).toBeTruthy();
  });
});
