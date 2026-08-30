import { afterEach, describe, expect, it, vi } from "vitest";

import { originFromHostPort, readStoredAppsOrigin, writeStoredAppsOrigin } from "../src/client/apps-host.ts";
import {
  formToHostConfigBody,
  parseCommitDetail,
  parsePalettes,
  parseStorageTables,
  readJson,
} from "../src/client/http.ts";
import { DshPanelHost, type DshPanelHostHooks } from "../src/panel-host.ts";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function hooks(overrides: Partial<DshPanelHostHooks> = {}): DshPanelHostHooks & {
  calls: { origin: string[]; theme: Array<{ theme: string; palette: string }>; card: string[]; open: number; close: number; mount: string[]; unmount: string[]; reload: string[] };
} {
  const calls = {
    origin: [] as string[],
    theme: [] as Array<{ theme: string; palette: string }>,
    card: [] as string[],
    open: 0,
    close: 0,
    mount: [] as string[],
    unmount: [] as string[],
    reload: [] as string[],
  };
  return {
    calls,
    origin: () => "http://127.0.0.1:17880",
    setOrigin: (next) => {
      calls.origin.push(next);
    },
    theme: () => "light",
    palette: () => "default",
    dock: () => "fill",
    cardStyle: () => "stamp",
    setCardStyle: (v) => {
      calls.card.push(v);
    },
    persistThemeLocal: (theme, palette) => {
      calls.theme.push({ theme, palette });
    },
    openPanel: () => {
      calls.open += 1;
    },
    closePanel: () => {
      calls.close += 1;
    },
    mountFrame: (id) => {
      calls.mount.push(id);
    },
    unmountFrame: (id) => {
      calls.unmount.push(id);
    },
    reloadFrame: (id) => {
      calls.reload.push(id);
    },
    syncFramesEnv: () => undefined,
    storage: () => ({
      getItem: () => null,
      setItem: () => undefined,
    }),
    ...overrides,
  };
}

describe("DshPanelHost", () => {
  it("fetches apps and drives open/close/frame hooks", async () => {
    globalThis.fetch = vi.fn(async () => jsonOk({ apps: [{ id: "com.example.todo", name: "Todo" }] })) as typeof fetch;
    const h = hooks();
    const host = new DshPanelHost(h);
    host.openPanel();
    host.closePanel();
    host.frame.mount("com.example.todo");
    host.frame.unmount("com.example.todo");
    host.frame.reload("com.example.todo");
    expect(h.calls.open).toBe(1);
    expect(h.calls.close).toBe(1);
    expect(h.calls.mount).toEqual(["com.example.todo"]);
    const apps = await host.fetchApps();
    expect(apps[0]?.id).toBe("com.example.todo");
  });

  it("posts theme / palettes / config / history / storage / delete", async () => {
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/palettes")) return jsonOk({ palettes: [{ id: "c1", label: "C", swatch: "#111", custom: true }] });
      if (url.endsWith("/api/host-config") && method === "GET") {
        return jsonOk({ hostPort: 19191, locale: "en", theme: "dark", palette: "tokyo", llm: null });
      }
      if (url.endsWith("/api/host-config") && method === "POST") {
        return jsonOk({ ok: true, hostPort: 19191 });
      }
      if (url.includes("/history/") && !url.includes("?")) {
        return jsonOk({ commit: { id: "abc", message: "m", time: "t", files: [{ path: "a.ts", add: 1 }] } });
      }
      if (url.includes("/history")) return jsonOk({ commits: [{ id: "abc", message: "m", time: "t" }] });
      if (url.endsWith("/storage/kv")) return jsonOk({ value: { a: 1 } });
      if (url.includes("/storage")) return jsonOk({ tables: [{ name: "kv", size: 2 }] });
      return jsonOk({ ok: true });
    }) as typeof fetch;
    const h = hooks();
    const host = new DshPanelHost(h);
    host.persistTheme("dark", "tokyo");
    expect(h.calls.theme).toEqual([{ theme: "dark", palette: "tokyo" }]);
    await expect(host.palettes()).resolves.toEqual([{ id: "c1", label: "C", swatch: "#111", tokens: undefined }]);
    await host.appTheme.save("com.example.todo", { theme: "dark", palette: "tokyo" });
    await host.appTheme.clear("com.example.todo");
    const form = await host.config.load();
    expect(form.hostPort).toBe("19191");
    await host.config.save({ ...form, theme: "dark", palette: "tokyo", cardStyle: "hero", hostPort: "19191" });
    expect(h.calls.origin).toEqual(["http://127.0.0.1:19191"]);
    expect(h.calls.card).toEqual(["hero"]);
    await expect(host.history.list("com.example.todo")).resolves.toHaveLength(1);
    await expect(host.history.detail("com.example.todo", "abc")).resolves.toMatchObject({ id: "abc", message: "m" });
    await expect(host.storage.listTables("com.example.todo")).resolves.toEqual([{ name: "kv", size: 2, updatedAt: undefined }]);
    await expect(host.storage.readTable("com.example.todo", "kv")).resolves.toEqual({ a: 1 });
    await host.deleteApp("com.example.todo");
  });

  it("config.save throws when the host rejects the write", async () => {
    globalThis.fetch = vi.fn(async (input, init) => {
      if (String(input).includes("/api/host-config") && (init?.method ?? "GET") === "GET") {
        return jsonOk({ hostPort: 1, locale: "zh-CN", theme: "light", palette: "default" });
      }
      return jsonOk({ ok: false, error: "port in use" }, 400);
    }) as typeof fetch;
    const host = new DshPanelHost(hooks());
    await expect(host.config.save({ hostPort: "9", theme: "light", palette: "default" })).rejects.toThrow(/port in use/);
  });

  it("palettes returns [] when the request fails", async () => {
    globalThis.fetch = vi.fn(async () => jsonOk({}, 500)) as typeof fetch;
    const host = new DshPanelHost(hooks());
    await expect(host.palettes()).resolves.toEqual([]);
  });
});

describe("client http / origin helpers", () => {
  it("parses palettes, storage, commit detail and form llm", () => {
    expect(parsePalettes({ palettes: [{ id: "x", custom: false }] })).toEqual([]);
    expect(parsePalettes({ palettes: [{ id: "x", label: "X", tokens: { a: 1 } }] })[0]?.id).toBe("x");
    expect(parseStorageTables({ tables: [{ name: "t", updatedAt: "now" }] })).toEqual([
      { name: "t", size: undefined, updatedAt: "now" },
    ]);
    expect(parseCommitDetail({ commit: { id: "z" } }, "z").id).toBe("z");
    expect(parseCommitDetail(null, "z")).toEqual({ id: "z", message: "", time: "", files: [] });
    const body = formToHostConfigBody({ provider: "openai", model: "gpt", locale: "en", chatLanguage: "", theme: "dark", palette: "tokyo", hostPort: "12" });
    expect(body.llm).toEqual({ provider: "openai", model: "gpt" });
    expect(originFromHostPort("9", "http://127.0.0.1:1")).toBe("http://127.0.0.1:9");
    expect(originFromHostPort("nope", "http://keep")).toBe("http://keep");
    writeStoredAppsOrigin(null, "x");
    expect(readStoredAppsOrigin(null)).toBeNull();
    expect(readStoredAppsOrigin({ getItem: () => "not-a-url" })).toBeNull();
    expect(
      readStoredAppsOrigin({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBeNull();
    writeStoredAppsOrigin(
      {
        setItem: () => {
          throw new Error("blocked");
        },
      },
      "http://127.0.0.1:1",
    );
  });

  it("readJson throws on HTTP errors", async () => {
    globalThis.fetch = vi.fn(async () => jsonOk({}, 404)) as typeof fetch;
    await expect(readJson("http://127.0.0.1/x")).rejects.toThrow(/HTTP 404/);
  });
});
