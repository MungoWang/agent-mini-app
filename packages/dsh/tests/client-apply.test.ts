// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { getPanelState, resetPanelState } from "@monkey-mini-app/panel";

import { apply, FooterButton, name } from "../src/client/index.ts";

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

class FakeEventSource {
  static last: FakeEventSource | null = null;
  readonly url: string;
  readonly listeners = new Map<string, Array<(ev: MessageEvent<string>) => void>>();
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  addEventListener(type: string, fn: (ev: MessageEvent<string>) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) {
      fn({ data } as MessageEvent<string>);
    }
  }
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  vi.stubGlobal("ResizeObserver", FakeRO);
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("setInterval", () => 0);
  vi.stubGlobal("requestAnimationFrame", () => 1);
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
    if (url.includes("/api/apps")) {
      return new Response(JSON.stringify({ apps: [{ id: "com.example.todo", name: "Todo" }] }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/host-config")) {
      return new Response(JSON.stringify({ ok: true, hostPort: 17880, theme: "light", palette: "default", locale: "zh-CN" }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  window.localStorage.clear();
  document.body.innerHTML = "";
  resetPanelState();
  window.__mmaOpenBound = false;
  window.__mmaRailWatch = false;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  document.body.innerHTML = "";
  resetPanelState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeEventSource.last = null;
});

describe("client apply / FooterButton", () => {
  it("exports the client plugin name and renders a footer button", async () => {
    expect(name).toBe("monkey-mini-app-client");
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(FooterButton({ wide: true }));
    });
    expect(el.querySelector("[data-mma-open]")?.getAttribute("title")).toBe("小程序");
    await act(async () => {
      root.render(FooterButton({ wide: false }));
    });
    expect(el.querySelector(".mma-foot-label")?.getAttribute("style")).toContain("none");
    await act(async () => {
      root.unmount();
    });
  });

  it("injects the footer slot, toggles on click, and handles SSE app:open", async () => {
    const registered: unknown[] = [];
    const disposeSlot = vi.fn();
    const stop = apply({
      slots: {
        inject: (_slot, fn) => {
          fn();
          return disposeSlot;
        },
        register: (meta, component) => {
          registered.push({ meta, component });
          return { ok: true };
        },
      },
    });
    expect(registered[0]).toMatchObject({ meta: { id: "monkey-mini-app" } });
    expect(document.getElementById("mma-foot-css")?.textContent).toContain(".mma-foot-btn");
    const btn = document.createElement("button");
    btn.setAttribute("data-mma-open", "1");
    document.body.appendChild(btn);
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.getElementById("mma-host")).toBeTruthy();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    const es = FakeEventSource.last;
    expect(es?.url).toContain("/api/events");
    await act(async () => {
      es?.emit("app:open", JSON.stringify({ appId: "com.example.todo" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    stop();
    expect(disposeSlot).toHaveBeenCalled();
    expect(es?.closed).toBe(true);
  });

  it("answers a host view query with not-open when no frame is showing the app", async () => {
    const ctx = {
      slots: {
        inject: () => () => undefined,
        register: () => undefined,
      },
    };
    const stop = apply(ctx as never);
    const es = FakeEventSource.last;
    expect(es).toBeTruthy();
    (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length = 0;

    // Malformed frames must not throw into the stream, and must not POST anything either.
    es!.emit("app:eval", "not json");
    es!.emit("app:eval", JSON.stringify({ appId: "com.example.todo" }));
    es!.emit("app:eval", JSON.stringify({ requestId: "v1" }));
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(0);

    await act(async () => {
      es!.emit("app:eval", JSON.stringify({ requestId: "v2", appId: "com.example.todo", code: "return 1", maxBytes: 512 }));
    });
    const posts = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.map((c) => String(c[0]))
      .filter((u) => u.endsWith("/view/eval"));
    // One stream, no second EventSource: the client already had this connection open.
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain("/api/app/com.example.todo/view/eval");
    stop();
  });

  it("still binds UI events when slots.inject throws", () => {
    const stop = apply({
      slots: {
        inject: () => {
          throw new Error("no slots");
        },
      },
    });
    expect(window.__mmaOpenBound).toBe(true);
    stop();
  });

  it("follows ctx.locale and locale/change for panel chrome", () => {
    let active = "en";
    const listeners: Array<(snap: unknown) => void> = [];
    const stop = apply({
      slots: {
        inject: () => () => undefined,
        register: () => undefined,
      },
      locale: { getLocale: () => ({ active }) },
      on: (_event: string, fn: (snap: unknown) => void) => {
        listeners.push(fn);
        return () => undefined;
      },
    } as never);
    expect(getPanelState().locale).toBe("en");
    expect(getPanelState().emptyText).toMatch(/No mini apps yet/);
    active = "zh";
    listeners[0]?.({ active: "zh" });
    expect(getPanelState().locale).toBe("zh-CN");
    expect(getPanelState().emptyText).toMatch(/还没有小程序/);
    stop();
  });
});
