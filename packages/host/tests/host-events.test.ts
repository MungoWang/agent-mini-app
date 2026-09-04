import { describe, expect, it, vi } from "vitest";

import {
  APP_ERROR_BUFFER,
  APP_EVENT_BUFFER,
  formatSse,
  type HostEvent,
  HostEventBus,
} from "@monkey-mini-app/host";

describe("HostEventBus", () => {
  it("fans out events to every subscriber and stops after unsubscribe", () => {
    const bus = new HostEventBus();
    const a: HostEvent[] = [];
    const b: HostEvent[] = [];
    const offA = bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));

    bus.emit({ type: "app:open", appId: "com.example.todo", title: "Todo" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    offA();
    bus.emit({ type: "app:open", appId: "com.example.x" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });

  it("drops a listener that throws so the rest still get the event", () => {
    const bus = new HostEventBus();
    const seen: HostEvent[] = [];
    bus.subscribe(() => {
      throw new Error("broken listener");
    });
    bus.subscribe((e) => seen.push(e));
    const emitSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => bus.emit({ type: "app:open", appId: "com.example.todo" })).not.toThrow();
    expect(seen).toHaveLength(1);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("emits into a snapshot so unsubscribing during emit is safe", () => {
    const bus = new HostEventBus();
    const seen: string[] = [];
    const off = bus.subscribe(() => {
      off();
      seen.push("first");
    });
    bus.subscribe(() => seen.push("second"));
    bus.emit({ type: "app:open", appId: "com.example.todo" });
    expect(seen).toEqual(["first", "second"]);
  });

  it("issues monotonic ids for SSE cursors", () => {
    const bus = new HostEventBus();
    expect([bus.nextId(), bus.nextId(), bus.nextId()]).toEqual([1, 2, 3]);
  });
});

describe("HostEventBus.pushApp", () => {
  it("numbers events per app and fans them out on the same bus", () => {
    const bus = new HostEventBus();
    const seen: HostEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    expect(bus.pushApp("com.a", "progress", { pct: 10 })).toBe(true);
    expect(bus.pushApp("com.b", "progress", { pct: 1 })).toBe(true);
    expect(bus.pushApp("com.a", "progress", { pct: 20 })).toBe(true);

    expect(seen.map((e) => (e.type === "app:event" ? e.seq : -1))).toEqual([1, 1, 2]);
    expect(bus.appLastSeq("com.a")).toBe(2);
    expect(bus.appLastSeq("com.b")).toBe(1);
    expect(bus.appLastSeq("com.never")).toBe(0);
  });

  it("drops a payload that cannot survive JSON instead of throwing into the call", () => {
    const bus = new HostEventBus();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(bus.pushApp("com.a", "bad", circular)).toBe(false);
    expect(bus.appLastSeq("com.a")).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("undefined data is allowed (a signal with no payload)", () => {
    const bus = new HostEventBus();
    expect(bus.pushApp("com.a", "done")).toBe(true);
    expect(bus.replay("com.a", 0).events[0]).toMatchObject({ name: "done", data: undefined });
  });

  it("replays only what the client missed, per app", () => {
    const bus = new HostEventBus();
    for (let i = 0; i < 3; i++) bus.pushApp("com.a", "tick", i);
    bus.pushApp("com.b", "tick", 99);

    const all = bus.replay("com.a", 0);
    expect(all.events.map((e) => (e.type === "app:event" ? e.data : null))).toEqual([0, 1, 2]);
    expect(all.gap).toBe(false);

    const tail = bus.replay("com.a", 2);
    expect(tail.events).toHaveLength(1);
    expect(tail.events[0]).toMatchObject({ seq: 3 });
  });

  it("reports a gap when the ring already evicted the client's cursor", () => {
    const bus = new HostEventBus();
    for (let i = 0; i < APP_EVENT_BUFFER + 20; i++) bus.pushApp("com.a", "tick", i);

    expect(bus.replay("com.a", APP_EVENT_BUFFER + 20).events).toHaveLength(0);
    const stale = bus.replay("com.a", 1);
    expect(stale.gap).toBe(true);
    // the kept tail is still delivered
    expect(stale.events[0]).toMatchObject({ seq: 21, data: 20 });
  });

  it("forget() clears history and restarts numbering for that app", () => {
    const bus = new HostEventBus();
    bus.pushApp("com.a", "tick", 1);
    bus.forget("com.a");
    expect(bus.replay("com.a", 0).events).toHaveLength(0);
    bus.pushApp("com.a", "tick", 2);
    expect(bus.appLastSeq("com.a")).toBe(1);
  });
});

describe("formatSse", () => {
  it("renders an id/event/data frame with a blank line terminator", () => {
    const frame = formatSse({ type: "app:open", appId: "com.example.todo", title: "T" }, 7);
    expect(frame).toBe(
      'id: 7\nevent: app:open\ndata: {"appId":"com.example.todo","title":"T"}\n\n',
    );
  });

  it("keeps an absent title in the payload so the client schema stays stable", () => {
    const frame = formatSse({ type: "app:open", appId: "a.b" }, 1);
    expect(frame).toContain('data: {"appId":"a.b"}');
  });
});

describe("formatSse app events", () => {
  it("carries name and data so the UI can route by channel", () => {
    const frame = formatSse(
      { type: "app:event", appId: "com.a", name: "progress", data: { pct: 40 }, seq: 12 },
      12,
    );
    expect(frame).toBe('id: 12\nevent: app:event\ndata: {"name":"progress","data":{"pct":40},"seq":12}\n\n');
  });
});

describe("HostEventBus runtime error ring", () => {
  it("keeps errors per app with a monotonic cursor", () => {
    const bus = new HostEventBus();
    const s1 = bus.reportAppError("com.a", { kind: "render", message: "boom" });
    const s2 = bus.reportAppError("com.b", { kind: "async", message: "other" });
    const s3 = bus.reportAppError("com.a", { kind: "uncaught", message: "again" });

    expect(bus.appErrorsFor("com.a")).toMatchObject({ lastSeq: s3, dropped: 0 });
    expect(bus.appErrorsFor("com.a").errors.map((e) => e.message)).toEqual(["boom", "again"]);
    expect(bus.appErrorsFor("com.a", s1).errors.map((e) => e.message)).toEqual(["again"]);
    expect(s2).toBeGreaterThan(s1);
  });

  it("normalises an unknown kind instead of rejecting the report", () => {
    const bus = new HostEventBus();
    bus.reportAppError("com.a", { kind: "who-knows", message: "x" });
    expect(bus.appErrorsFor("com.a").errors[0]).toMatchObject({ kind: "uncaught", message: "x" });
  });

  it("falls back to a placeholder message so a report cannot be empty", () => {
    const bus = new HostEventBus();
    bus.reportAppError("com.a", {});
    expect(bus.appErrorsFor("com.a").errors[0].message).toBe("(no message)");
  });

  it("clamps oversized stacks", () => {
    const bus = new HostEventBus();
    bus.reportAppError("com.a", { kind: "render", message: "m", stack: "x".repeat(9000) });
    expect(bus.appErrorsFor("com.a").errors[0].stack!.length).toBeLessThanOrEqual(4001);
  });

  it("counts what fell out of the ring, per app", () => {
    const bus = new HostEventBus();
    for (let i = 0; i < APP_ERROR_BUFFER + 5; i++) {
      bus.reportAppError("com.a", { kind: "uncaught", message: `e${i}` });
    }
    // A second app must not inflate com.a's `dropped`.
    bus.reportAppError("com.b", { kind: "uncaught", message: "unrelated" });

    const ring = bus.appErrorsFor("com.a");
    expect(ring.errors).toHaveLength(APP_ERROR_BUFFER);
    expect(ring.dropped).toBe(5);
    expect(ring.errors[ring.errors.length - 1].message).toBe(`e${APP_ERROR_BUFFER + 4}`);
    expect(bus.appErrorsFor("com.b")).toMatchObject({ dropped: 0 });
  });

  it("forgetErrors and forget both clear the ring", () => {
    const bus = new HostEventBus();
    bus.reportAppError("com.a", { kind: "render", message: "m" });
    bus.forgetErrors("com.a");
    expect(bus.appErrorsFor("com.a").errors).toEqual([]);

    bus.reportAppError("com.a", { kind: "render", message: "m" });
    bus.forget("com.a");
    expect(bus.appErrorsFor("com.a").errors).toEqual([]);
  });

  it("keeps only the newest snapshots", () => {
    const bus = new HostEventBus();
    bus.reportAppSnapshot("com.a", { dom: { t: "div", n: 1 } });
    bus.reportAppSnapshot("com.a", { dom: { t: "div", n: 2 }, viewport: { width: 800, height: 600 } });
    expect(bus.appSnapshot("com.a")).toMatchObject({ viewport: { width: 800, height: 600 } });
    expect((bus.appSnapshot("com.a")!.dom as { n: number }).n).toBe(2);
    expect(bus.appSnapshot("com.none")).toBeNull();
  });
});

describe("formatSse app:reload", () => {
  it("tells every connected panel that the bundle changed", () => {
    const frame = formatSse({ type: "app:reload", appId: "com.example.todo" }, 4);
    expect(frame).toBe('id: 4\nevent: app:reload\ndata: {"appId":"com.example.todo"}\n\n');
  });
});

describe("HostEventBus.listenerCount", () => {
  it("counts live browser subscribers, which is what mini_app_open reports", () => {
    const bus = new HostEventBus();
    expect(bus.listenerCount()).toBe(0);
    const off = bus.subscribe(() => {});
    bus.subscribe(() => {});
    expect(bus.listenerCount()).toBe(2);
    off();
    expect(bus.listenerCount()).toBe(1);
  });
});
