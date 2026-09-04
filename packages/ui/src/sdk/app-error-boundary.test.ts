// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiProvider } from "../i18n/context";
import { AppErrorBoundary } from "./app-error-boundary";
import { AppRuntime } from "./use-app";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const APP_ID = "com.test.boundary";
const ENDPOINT = `/api/app/${APP_ID}/errors`;

/** Throws the way a real generated app does: the name is defined, a different name is called. */
function Crashing(): ReturnType<typeof createElement> {
  const greet = undefined as unknown as () => string;
  return createElement("b", null, greet());
}

let container: HTMLElement;
let root: Root;

function renderTree(ui: React.ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Same nesting the host's compiled wrapper produces.
  act(() => {
    root.render(
      createElement(
        AppRuntime,
        { appId: APP_ID },
        createElement(UiProvider, { locale: "en" }, createElement(AppErrorBoundary, null, ui))
      )
    );
  });
}

function reports(): { url: string; body: Record<string, unknown> }[] {
  const mock = fetch as unknown as { mock: { calls: unknown[][] } };
  return mock.mock.calls.map(([url, init]) => ({
    url: String(url),
    body: JSON.parse(String((init as RequestInit).body)),
  }));
}

beforeEach(() => {
  // React re-logs a caught render error; that is expected, not a failure signal.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  // jsdom has no sendBeacon; force the path under test to be the fetch fallback.
  delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("renders children and reports nothing when they are fine", () => {
    renderTree(createElement("span", { "data-testid": "ok" }, "fine"));
    expect(container.textContent).toContain("fine");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a real message instead of leaving a blank iframe", () => {
    renderTree(createElement(Crashing));
    // Before the boundary, a render throw cleared the boot art and then rendered nothing.
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toMatch(/mini-app hit an error/);
    expect(alert?.textContent).toContain(APP_ID);
    expect(alert?.textContent).toMatch(/greet/);
  });

  it("reports kind=render to its own host with a component stack", () => {
    renderTree(createElement(Crashing));
    const calls = reports();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].body.kind).toBe("render");
    expect(String(calls[0].body.message)).toMatch(/greet/);
    // componentStack names the component; a raw stack does not.
    expect(String(calls[0].body.componentStack)).toContain("Crashing");
  });

  it("re-reports on retry instead of going silent", () => {
    renderTree(createElement(Crashing));
    const before = reports().length;
    const retry = [...container.querySelectorAll("button")].find((b) => /Retry/i.test(b.textContent || ""));
    expect(retry).toBeDefined();
    act(() => (retry as HTMLButtonElement).click());
    expect(reports().length).toBeGreaterThan(before);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("never lets a failed report throw back into the app", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => renderTree(createElement(Crashing))).not.toThrow();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
