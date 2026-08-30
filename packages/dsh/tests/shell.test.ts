// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { getPanelState, resetPanelState, setPanelState } from "@monkey-mini-app/panel";

import { DshShell } from "../src/client/shell.ts";

class FakeRO {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  vi.stubGlobal("ResizeObserver", FakeRO);
  vi.stubGlobal("setInterval", () => 0);
  vi.stubGlobal("clearInterval", () => undefined);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/host-config")) {
      return new Response(
        JSON.stringify({
          ok: true,
          hostPort: 19191,
          theme: "dark",
          palette: "tokyo",
          locale: "en",
        }),
        { headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/apps")) {
      return new Response(JSON.stringify({ apps: [{ id: "com.example.todo", name: "Todo" }] }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  window.localStorage.clear();
  document.body.innerHTML = "";
  document.documentElement.className = "";
  resetPanelState();
  window.__mmaRailWatch = false;
  window.__mmaOpenBound = false;
});

afterEach(() => {
  resetPanelState();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DshShell", () => {
  it("creates a skeleton, opens, toggles dock, and disposes", async () => {
    const shell = new DshShell();
    expect(shell.origin).toContain("127.0.0.1");
    await act(async () => {
      shell.openPanel();
    });
    const host = document.getElementById("mma-host");
    expect(host).toBeTruthy();
    expect(host?.style.display).toBe("flex");
    expect(getPanelState().visible).toBe(true);
    await act(async () => {
      shell.setCardStyle("hero");
    });
    expect(host?.getAttribute("data-cardstyle")).toBe("hero");
    await act(async () => {
      shell.ensureSkeleton();
    });
    setPanelState({ dock: "side" });
    shell.followDockFromStore();
    expect(shell.layout.dock).toBe("side");
    shell.followDockFromStore();
    await act(async () => {
      shell.toggle();
    });
    expect(shell.layout.closing || !shell.layout.visible).toBe(true);
    await act(async () => {
      shell.dispose();
    });
    expect(document.getElementById("mma-host")).toBeNull();
  });

  it("opens from a stored side dock and close without a host is a no-op", async () => {
    window.localStorage.setItem("mma-dock", "side");
    window.localStorage.setItem("mma-theme-mode", "dark");
    window.localStorage.setItem("mma-palette", "tokyo");
    const shell = new DshShell();
    expect(shell.layout.dock).toBe("side");
    await act(async () => {
      shell.openPanel();
    });
    expect(document.getElementById("mma-host")?.getAttribute("data-dock")).toBe("side");
    await act(async () => {
      shell.closePanel();
      shell.dispose();
    });
    const empty = new DshShell();
    empty.closePanel();
    empty.dispose();
  });

  it("persists theme through the panel host hook", async () => {
    const shell = new DshShell();
    await act(async () => {
      shell.openPanel();
    });
    await act(async () => {
      shell.host.persistTheme?.("dark", "tokyo");
    });
    expect(window.localStorage.getItem("mma-theme-mode")).toBe("dark");
    expect(window.localStorage.getItem("mma-palette")).toBe("tokyo");
    await act(async () => {
      shell.dispose();
    });
  });
});
