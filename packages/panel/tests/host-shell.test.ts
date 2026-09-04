// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import {
  createHostShell,
  getPanelState,
  type HostShellInstance,
  resetPanelState,
} from "@monkey-mini-app/panel";

const todo = { id: "com.example.todo", name: "Todo", description: "tasks", acronym: "Td" };

const origFetch = globalThis.fetch;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, ((ev: MessageEvent<string>) => void)[]>();
  closed = false;
  constructor(readonly url: string) {
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
      cb({ data: JSON.stringify(data) } as MessageEvent<string>);
    }
  }
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
      map.set(k, String(v));
    },
  } as Storage;
}

let shell: HostShellInstance | null = null;

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith("/api/apps")) {
      return new Response(JSON.stringify({ apps: [todo] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/api/palettes")) {
      return new Response(JSON.stringify({ palettes: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  act(() => {
    shell?.unmount();
  });
  shell = null;
  document.body.innerHTML = "";
  resetPanelState();
  vi.unstubAllGlobals();
  globalThis.fetch = origFetch;
});

/** mount() creates its own #mma-host inside this wrapper, so the wrapper must not share the id. */
function hostEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "mount-root";
  document.body.appendChild(el);
  return el;
}

function shellEl(): HTMLElement {
  return document.querySelector("#mount-root > #mma-host") as HTMLElement;
}

async function booted(): Promise<HostShellInstance> {
  const s = createHostShell({
    hostUrl: "http://127.0.0.1:17880",
    storage: memoryStorage(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
  });
  shell = s;
  const el = hostEl();
  await act(async () => {
    s.mount(el);
  });
  return s;
}

describe("createHostShell", () => {
  it("mounts the chrome, opens one event stream and fetches apps", async () => {
    const s = await booted();
    expect(shellEl().getAttribute("data-ready")).toBe("1");
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("http://127.0.0.1:17880/api/events");
    expect(getPanelState().apps.map((a) => a.id)).toEqual([todo.id]);
    expect(s.frames).toBeDefined();
  });

  it("reloads an already-open iframe when the host reports a rebuild", async () => {
    const s = await booted();
    // Through the host facade, which is what lazily binds #mma-frames after React paints.
    act(() => s.host.frame.mount(todo.id));
    const iframe = shellEl().querySelector("#mma-frames iframe") as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    const before = iframe.src;

    // The whole point: without this the agent says "refresh if it still errors".
    await act(async () => {
      FakeEventSource.instances[0].emit("app:reload", { appId: todo.id });
    });

    expect(s.frames.map.has(todo.id)).toBe(true);
    expect(iframe.src).not.toBe(before);
    expect(iframe.src).toContain(`_=`);
  });

  it("ignores a reload for an app nobody has open", async () => {
    const s = await booted();
    expect(() =>
      FakeEventSource.instances[0].emit("app:reload", { appId: "com.not.mounted" })
    ).not.toThrow();
    expect(s.frames.map.size).toBe(0);
  });

  it("relays a host view query into the open iframe", async () => {
    const s = await booted();
    act(() => s.host.frame.mount(todo.id));
    const iframe = shellEl().querySelector("#mma-frames iframe") as HTMLIFrameElement;
    const posted: Array<{ msg: unknown; target: string }> = [];
    const win = { postMessage: (msg: unknown, target: string) => posted.push({ msg, target }) };
    Object.defineProperty(iframe, "contentWindow", { value: win, configurable: true });

    await act(async () => {
      FakeEventSource.instances[0].emit("app:eval", {
        appId: todo.id,
        requestId: "v7",
        code: "return 1",
        maxBytes: 2048,
      });
    });
    expect(posted[0].msg).toMatchObject({ type: "mma-view-eval", requestId: "v7" });
    // Never "*": the answer is only deliverable to the host that asked.
    expect(posted[0].target).toBe("http://127.0.0.1:17880");
  });

  it("answers not-open for an app no iframe is showing, instead of timing out", async () => {
    const s = await booted();
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const before = calls.length;

    await act(async () => {
      FakeEventSource.instances[0].emit("app:eval", {
        appId: "com.never.mounted",
        requestId: "v8",
        code: "return 1",
        maxBytes: 2048,
      });
    });
    const posted = calls
      .slice(before)
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/view/eval"));
    expect(posted).toEqual(["http://127.0.0.1:17880/api/app/com.never.mounted/view/eval"]);
    expect(s.frames.map.size).toBe(0);
  });

  it("toggles the panel through the injected callbacks", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const s = createHostShell({ hostUrl: "http://h", storage: memoryStorage(), onOpen, onClose });
    shell = s;
    await act(async () => {
      s.mount(hostEl());
    });
    s.openPanel();
    expect(onOpen).toHaveBeenCalled();
    s.closePanel();
    expect(onClose).toHaveBeenCalled();
  });

  it("persists theme + card style + dock onto storage and the DOM", async () => {
    const storage = memoryStorage();
    const layout = { setDock: vi.fn(), getDock: () => "side" as const };
    const s = createHostShell({ hostUrl: "http://h", storage, layout });
    shell = s;
    await act(async () => {
      s.mount(hostEl());
    });

    act(() => s.persistTheme("dark", "tokyo"));
    expect(storage.getItem("mma-theme-mode")).toBe("dark");
    expect(storage.getItem("mma-palette")).toBe("tokyo");
    expect(getPanelState().theme).toBe("dark");

    s.setCardStyle("etch");
    expect(storage.getItem("mma-card-style")).toBe("etch");
    expect(shellEl().getAttribute("data-cardstyle")).toBe("etch");

    s.setDock("fill");
    expect(getPanelState().dock).toBe("fill");
    expect(layout.setDock).toHaveBeenCalledWith("fill");
  });

  it("closes the event stream on unmount", async () => {
    const s = await booted();
    const es = FakeEventSource.instances[0];
    act(() => s.unmount());
    shell = null;
    expect(es.closed).toBe(true);
    expect(shellEl()).toBeNull();
  });
});
