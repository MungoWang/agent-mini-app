import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { LogViewer } from "./log-viewer";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    value: 800,
  });
});

describe("LogViewer", () => {
  it("renders entries and finds level labels", () => {
    render(
      <LogViewer
        entries={[
          { level: "info", message: "boot" },
          { level: "warn", message: "slow" },
          { level: "error", message: "boom" },
          { level: "debug", message: "skip" },
          { level: "verbose", message: "trace" },
        ]}
      />
    );

    const root = screen.getByTestId("log-viewer");
    expect(root).toBeTruthy();
    expect(root).toHaveTextContent("INF");
    expect(root).toHaveTextContent("WRN");
    expect(root).toHaveTextContent("ERR");
    expect(root).toHaveTextContent("DBG");
    expect(root).toHaveTextContent("VRB");
    expect(root).toHaveTextContent("boot");
    expect(root).toHaveTextContent("boom");
  });

  it("shows empty state", () => {
    render(<LogViewer entries={[]} />);
    expect(screen.getByTestId("log-viewer")).toHaveTextContent("No log entries.");
  });
});
