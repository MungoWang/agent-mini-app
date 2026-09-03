// @vitest-environment jsdom
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRuntime, useApp } from "./use-app.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AppApi = ReturnType<typeof useApp>;

/** Minimal EventSource double: records the URL and lets tests push frames. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  onerror: ((e: unknown) => void) | null = null;
  private handlers = new Map<string, Set<(e: { data: string }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: { data: string }) => void) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(cb);
    this.handlers.set(type, set);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    for (const cb of this.handlers.get(type) ?? []) {
      cb({ data: typeof payload === "string" ? payload : JSON.stringify(payload) });
    }
  }
}

let root: Root | null = null;
let el: HTMLElement | null = null;

// Unique per call: module-level stream state is shared by appId, and a failed
// assertion can leave subscribers behind.
let mountSeq = 0;

function mount(appId = `com.example.probe${(mountSeq += 1)}`) {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  let api: AppApi | null = null;
  act(() => {
    root!.render(
      createElement(AppRuntime, {
        appId,
        children: createElement(Probe, { onApi: (next) => { api = next; } }),
      }),
    );
  });
  return api as AppApi;
}

function Probe(props: { onApi: (api: AppApi) => void }) {
  props.onApi(useApp());
  return null;
}

describe("useApp", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    el?.remove();
    root = null;
    el = null;
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("posts /api/call with appId from AppRuntime", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, value: { pong: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
    let api: AppApi | null = null;
    act(() => {
      root!.render(
        createElement(AppRuntime, {
          appId: "com.example.todo",
          children: createElement(Probe, { onApi: (next) => { api = next; } }),
        }),
      );
    });
    await expect(api!.call("ping", { n: 1 })).resolves.toEqual({ pong: true });
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("on() opens one per-app stream and routes by channel name", () => {
    const api = mount();
    const got: unknown[] = [];
    const off = api.on("progress", (d) => got.push(d));

    const es = FakeEventSource.instances[0] as unknown as FakeEventSource;
    expect(es.url).toContain("/api/app/com.example.probe");

    es.emit("app:event", { name: "progress", data: { pct: 40 }, seq: 1 });
    es.emit("app:event", { name: "other", data: "x", seq: 2 });
    expect(got).toEqual([{ pct: 40 }]);

    // "*" is the wildcard channel
    const any: unknown[] = [];
    const offAny = api.on("*", (d) => any.push(d));
    es.emit("app:event", { name: "progress", data: { pct: 60 }, seq: 3 });
    expect(any).toEqual([{ pct: 60 }]);

    off();
    offAny();
    expect(es.closed).toBe(true);
  });

  it("onAny() receives name and data; a gap frame arrives as a synthetic event", () => {
    const api = mount();
    const events: { name: string; data: unknown }[] = [];
    const off = api.onAny((e) => events.push(e));
    const es = FakeEventSource.instances[0] as unknown as FakeEventSource;

    es.emit("app:event", { name: "tick", data: 1, seq: 1 });
    es.emit("app:gap", { appId: "com.example.probe", since: 4 });
    expect(events).toEqual([
      { name: "tick", data: 1 },
      { name: "*", data: { gap: true } },
    ]);
    off();
  });

  it("shares one stream between subscribers and closes it with the last", () => {
    const api = mount();
    const off1 = api.on("a", () => {});
    const off2 = api.on("b", () => {});
    expect(FakeEventSource.instances).toHaveLength(1);

    off1();
    const es = FakeEventSource.instances[0] as unknown as FakeEventSource;
    expect(es.closed).toBe(false);
    off2();
    expect(es.closed).toBe(true);
  });

  it("ignores frames that are not valid JSON or lack a channel name", () => {
    const api = mount();
    const got: unknown[] = [];
    const off = api.onAny((e) => got.push(e));
    const es = FakeEventSource.instances[0] as unknown as FakeEventSource;

    es.emit("app:event", "not json{");
    es.emit("app:event", { data: 1 });
    expect(got).toEqual([]);
    off();
  });

  it("without EventSource in the engine the hook still works (no stream)", () => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    const api = mount();
    const off = api.on("progress", () => {
      throw new Error("must not fire");
    });
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(() => off()).not.toThrow();
  });

  it("a listener that throws does not stop the others", () => {
    const api = mount();
    const warn = vi.spyOn(console, "error");
    const got: unknown[] = [];
    const offBad = api.on("tick", () => {
      throw new Error("bad listener");
    });
    const offGood = api.on("tick", (d) => got.push(d));
    const es = FakeEventSource.instances[0] as unknown as FakeEventSource;
    es.emit("app:event", { name: "tick", data: 1, seq: 1 });
    expect(got).toEqual([1]);
    offBad();
    offGood();
    expect(warn).not.toHaveBeenCalled();
  });
});
