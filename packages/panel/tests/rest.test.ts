// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRestPanelHost } from "@monkey-mini-app/panel";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function routeFetch(routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>): typeof fetch {
  return (async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url}`;
    const route = routes[key] ?? routes[url];
    if (route) return route(init);
    return jsonOk({ ok: true });
  }) as typeof fetch;
}

function memoryStorage(): Storage | null {
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
  };
}

describe("createRestPanelHost", () => {
  it("fetches apps, palettes, history, storage and delete", async () => {
    globalThis.fetch = routeFetch({
      "GET http://127.0.0.1:17880/api/apps": () => jsonOk({ apps: [{ id: "com.example.todo", name: "Todo" }] }),
      "GET http://127.0.0.1:17880/api/palettes": () => jsonOk({ palettes: [{ id: "c1", label: "C", swatch: "#111", custom: true }] }),
      "GET http://127.0.0.1:17880/api/apps/com.example.todo/history?limit=50": () => jsonOk({ commits: [{ id: "abc", message: "m", time: "t" }] }),
      "GET http://127.0.0.1:17880/api/apps/com.example.todo/history/abc": () => jsonOk({ commit: { id: "abc", message: "m", time: "t", files: [{ path: "a.ts", add: 1 }] } }),
      "GET http://127.0.0.1:17880/api/apps/com.example.todo/storage": () => jsonOk({ tables: [{ name: "kv", size: 2 }] }),
      "GET http://127.0.0.1:17880/api/apps/com.example.todo/storage/kv": () => jsonOk({ value: { a: 1 } }),
      "DELETE http://127.0.0.1:17880/api/app/com.example.todo": () => jsonOk({ ok: true }),
    }) as typeof fetch;
    const storage = memoryStorage();
    const host = createRestPanelHost({ hostUrl: "http://127.0.0.1:17880/", storage, cardStyle: "hero" });
    const apps = await host.fetchApps();
    expect(apps[0]?.id).toBe("com.example.todo");
    await expect(host.palettes?.()).resolves.toEqual([{ id: "c1", label: "C", swatch: "#111", tokens: undefined }]);
    await expect(host.history!.list("com.example.todo")).resolves.toHaveLength(1);
    await expect(host.history!.detail("com.example.todo", "abc")).resolves.toMatchObject({ id: "abc", message: "m" });
    await expect(host.storage!.listTables("com.example.todo")).resolves.toEqual([{ name: "kv", size: 2, updatedAt: undefined }]);
    await expect(host.storage!.readTable("com.example.todo", "kv")).resolves.toEqual({ a: 1 });
    await host.deleteApp!("com.example.todo");
  });

  it("posts theme to storage and host-config", async () => {
    const posted: string[] = [];
    globalThis.fetch = routeFetch({
      "GET http://127.0.0.1:17880/api/host-config": () => jsonOk({ hostPort: 17880, locale: "zh-CN", theme: "dark", palette: "tokyo", llm: null }),
      "POST http://127.0.0.1:17880/api/host-config": (init) => {
        posted.push(String(init?.body));
        return jsonOk({ ok: true, hostPort: 19191 });
      },
    }) as typeof fetch;
    const storage = memoryStorage();
    const onHostChange = vi.fn();
    const onConfigSaved = vi.fn();
    const host = createRestPanelHost({
      hostUrl: "http://127.0.0.1:17880",
      storage,
      cardStyle: "stamp",
      onHostChange,
      onConfigSaved,
    });
    await host.appTheme!.save("com.example.todo", { theme: "dark", palette: "tokyo" });
    await host.appTheme!.clear("com.example.todo");

    host.persistTheme?.("dark", "tokyo");
    expect(storage?.getItem("mma-theme-mode")).toBe("dark");
    expect(storage?.getItem("mma-palette")).toBe("tokyo");

    const form = await host.config!.load();
    expect(form.hostPort).toBe("17880");
    await host.config!.save({ ...form, theme: "dark", palette: "tokyo", cardStyle: "hero", hostPort: "19191" });
    expect(onHostChange).toHaveBeenCalledWith("http://127.0.0.1:19191");
    expect(onConfigSaved).toHaveBeenCalled();
    expect(posted.length).toBeGreaterThan(0);
  });

  it("throws when the host rejects the config write", async () => {
    globalThis.fetch = routeFetch({
      "GET http://127.0.0.1:17880/api/host-config": () => jsonOk({ hostPort: 1, locale: "zh-CN", theme: "light", palette: "default" }),
      "POST http://127.0.0.1:17880/api/host-config": () => jsonOk({ ok: false, error: "port in use" }, 400),
    }) as typeof fetch;
    const host = createRestPanelHost({ hostUrl: "http://127.0.0.1:17880", storage: memoryStorage() });
    await expect(host.config!.save({ hostPort: "9", theme: "light", palette: "default" })).rejects.toThrow(/port in use/);
  });

  it("palettes returns [] when the request fails", async () => {
    globalThis.fetch = (async () => jsonOk({}, 500)) as typeof fetch;
    const host = createRestPanelHost({ hostUrl: "http://127.0.0.1:17880", storage: memoryStorage() });
    await expect(host.palettes?.()).resolves.toEqual([]);
  });

  it("reads origin dynamically via getHostUrl", async () => {
    let origin = "http://127.0.0.1:17880";
    const seen: string[] = [];
    globalThis.fetch = (async (input) => {
      seen.push(String(input));
      return jsonOk({ apps: [] });
    }) as typeof fetch;
    const host = createRestPanelHost({ hostUrl: origin, getHostUrl: () => origin, storage: memoryStorage() });
    await host.fetchApps();
    origin = "http://127.0.0.1:19191";
    await host.fetchApps();
    expect(seen).toEqual(["http://127.0.0.1:17880/api/apps", "http://127.0.0.1:19191/api/apps"]);
  });

  it("uses a provided frame controller for iframe wiring", async () => {
    globalThis.fetch = (async () => jsonOk({ apps: [] })) as typeof fetch;
    const mounted: string[] = [];
    const host = createRestPanelHost({
      hostUrl: "http://127.0.0.1:17880",
      storage: memoryStorage(),
      frameController: {
        url: (id) => `http://127.0.0.1:17880/app/${id}`,
        mount: (id) => mounted.push(id),
        unmount: () => undefined,
        reload: () => undefined,
      },
    });
    host.frame.mount("com.example.todo");
    expect(mounted).toEqual(["com.example.todo"]);
    expect(host.frame.url("com.example.todo")).toBe("http://127.0.0.1:17880/app/com.example.todo");
  });
});
