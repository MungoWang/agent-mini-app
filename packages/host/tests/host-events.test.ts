import { describe, expect, it, vi } from "vitest";

import { formatSse,type HostEvent, HostEventBus } from "@monkey-mini-app/host";

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
