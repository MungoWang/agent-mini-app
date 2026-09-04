// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeHostEvents } from "@monkey-mini-app/panel";

/**
 * jsdom ships no EventSource, and the point of this module is the event *dispatch*, not
 * the network — so a hand-controlled fake that can emit named frames is the honest stand-in.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readonly listeners = new Map<string, ((ev: MessageEvent<string>) => void)[]>();
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (ev: MessageEvent<string>) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    for (const cb of this.listeners.get(type) ?? []) {
      cb({ data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent<string>);
    }
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function last(): FakeEventSource {
  return FakeEventSource.instances[FakeEventSource.instances.length - 1];
}

describe("subscribeHostEvents", () => {
  it("opens one stream against the host origin, trailing slash trimmed", () => {
    const off = subscribeHostEvents("http://127.0.0.1:17880/", {});
    expect(last().url).toBe("http://127.0.0.1:17880/api/events");
    off();
    expect(last().closed).toBe(true);
  });

  it("routes app:open to onOpen", () => {
    const onOpen = vi.fn();
    subscribeHostEvents("http://h", { onOpen });
    last().emit("app:open", { appId: "com.example.todo", title: "Todo" });
    expect(onOpen).toHaveBeenCalledWith("com.example.todo", "Todo");
  });

  it("routes app:open without a title (the payload shape is stable)", () => {
    const onOpen = vi.fn();
    subscribeHostEvents("http://h", { onOpen });
    last().emit("app:open", { appId: "com.example.todo" });
    expect(onOpen).toHaveBeenCalledWith("com.example.todo", undefined);
  });

  it("routes app:reload, which is what keeps an open iframe from showing old code", () => {
    const onReload = vi.fn();
    subscribeHostEvents("http://h", { onReload });
    last().emit("app:reload", { appId: "com.example.todo" });
    expect(onReload).toHaveBeenCalledWith("com.example.todo");
  });

  it("ignores frames it cannot parse rather than throwing into the panel", () => {
    const onOpen = vi.fn();
    const onReload = vi.fn();
    subscribeHostEvents("http://h", { onOpen, onReload });
    expect(() => last().emit("app:open", "not json")).not.toThrow();
    expect(() => last().emit("app:open", [1, 2])).not.toThrow();
    expect(() => last().emit("app:reload", { appId: 42 })).not.toThrow();
    expect(() => last().emit("app:reload", {})).not.toThrow();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("routes app:eval with the query an iframe needs to answer", () => {
    const onEval = vi.fn();
    subscribeHostEvents("http://h", { onEval });
    last().emit("app:eval", { appId: "com.example.todo", requestId: "v1", code: "return 1", maxBytes: 512 });
    expect(onEval).toHaveBeenCalledWith({
      appId: "com.example.todo",
      requestId: "v1",
      code: "return 1",
      maxBytes: 512,
    });
  });

  it("drops an app:eval frame it cannot address (no id, nothing to answer to)", () => {
    const onEval = vi.fn();
    subscribeHostEvents("http://h", { onEval });
    last().emit("app:eval", { appId: "com.example.todo" });
    last().emit("app:eval", { requestId: "v1" });
    expect(onEval).not.toHaveBeenCalled();
  });

  it("is inert when the engine has no EventSource (a UI must still render)", () => {
    vi.stubGlobal("EventSource", undefined);
    expect(() => subscribeHostEvents("http://h", { onOpen: vi.fn() })).not.toThrow();
  });
});
