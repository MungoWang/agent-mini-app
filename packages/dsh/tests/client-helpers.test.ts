import { describe, expect, it } from "vitest";

import {
  appFrameUrl,
  formToHostConfigBody,
  hostConfigToForm,
  parseAppsResponse,
  parseCommitDetail,
  parseCommitList,
  parsePalettes,
  parseStorageTables,
  readJson,
} from "@monkey-mini-app/panel";

import {
  APPS_HOST_KEY,
  appsOrigin,
  originFromHostPort,
  readStoredAppsOrigin,
  resolveAppsOrigin,
  writeStoredAppsOrigin,
} from "../src/client/apps-host.ts";
import { layoutBox, sideWidthPx } from "../src/client/layout-box.ts";
import { isDarkFromProbes } from "../src/client/theme.ts";
import { clampCardStyle, escapeHtml, luminanceOf } from "../src/client/utils.ts";

function memoryStorage(init: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(init));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe("apps host / frame url", () => {
  it("builds http://127.0.0.1:${port}", () => {
    expect(appsOrigin(17880)).toBe("http://127.0.0.1:17880");
    expect(appsOrigin(9)).toBe("http://127.0.0.1:9");
    expect(() => appsOrigin(0)).toThrow(/invalid host port/);
  });

  it("builds /app/:appId frame urls from origin + env", () => {
    const url = appFrameUrl("http://127.0.0.1:19001", "com.example.todo", {
      theme: "dark",
      palette: "tokyo",
      dock: "side",
    });
    expect(url.startsWith("http://127.0.0.1:19001/app/com.example.todo?")).toBe(true);
    expect(url).toContain("theme=dark");
    expect(url).toContain("palette=tokyo");
    expect(url).toContain("dock=side");
  });

  it("resolves stored origin before the fallback port", () => {
    const storage = memoryStorage({ [APPS_HOST_KEY]: "http://127.0.0.1:19001/" });
    expect(readStoredAppsOrigin(storage)).toBe("http://127.0.0.1:19001/");
    expect(resolveAppsOrigin(undefined, storage)).toBe("http://127.0.0.1:19001");
    writeStoredAppsOrigin(storage, "http://127.0.0.1:19191");
    expect(storage.getItem(APPS_HOST_KEY)).toBe("http://127.0.0.1:19191");
    expect(originFromHostPort(19191, "http://127.0.0.1:17880")).toBe("http://127.0.0.1:19191");
  });
});

describe("parse helpers", () => {
  it("parseAppsResponse reads { apps }", () => {
    expect(parseAppsResponse({ apps: [{ id: "com.example.todo", name: "Todo" }] })).toEqual([
      { id: "com.example.todo", name: "Todo", description: undefined, acronym: undefined, commits: undefined, version: undefined, theme: undefined },
    ]);
    expect(parseAppsResponse(null)).toEqual([]);
  });

  it("maps host-config json to settings form without inventing llm defaults", () => {
    const form = hostConfigToForm(
      {
        ok: true,
        hostPort: 17880,
        locale: "en",
        chatLanguage: "zh-CN",
        theme: "dark",
        palette: "tokyo",
        llm: null,
      },
      "stamp",
    );
    expect(form.hostPort).toBe("17880");
    expect(form.locale).toBe("en");
    expect(form.provider).toBe("");
    expect(form.model).toBe("");
    const body = formToHostConfigBody({ ...form, provider: "", model: "" });
    expect(body.llm).toBeNull();
    expect(body.hostPort).toBe(17880);
    expect(body.locale).toBe("en");
  });

  it("parseCommitList accepts commits or nodes", () => {
    expect(parseCommitList({ commits: [{ id: "abc", message: "m", time: "t" }] })).toEqual([
      { id: "abc", message: "m", time: "t", files: undefined },
    ]);
    expect(parseCommitList({ nodes: [{ id: "n1", message: "x", time: "now" }] })[0]?.id).toBe("n1");
  });

  it("parses palettes, storage and commit detail defaults", () => {
    expect(parsePalettes({ palettes: [{ id: "x", custom: false }] })).toEqual([]);
    expect(parsePalettes({ palettes: [{ id: "x", label: "X", tokens: { a: 1 } }] })[0]?.id).toBe("x");
    expect(parseStorageTables({ tables: [{ name: "t", updatedAt: "now" }] })).toEqual([
      { name: "t", size: undefined, updatedAt: "now" },
    ]);
    expect(parseCommitDetail({ commit: { id: "z" } }, "z").id).toBe("z");
    expect(parseCommitDetail(null, "z")).toEqual({ id: "z", message: "", time: "", files: [] });
  });

  it("readJson throws on HTTP errors", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("{}", { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;
    await expect(readJson("http://127.0.0.1/x")).rejects.toThrow(/HTTP 404/);
    globalThis.fetch = orig;
  });
});

describe("layout / theme utils", () => {
  it("computes side and fill layout boxes", () => {
    expect(sideWidthPx(1000)).toBe(420);
    expect(layoutBox("side", 1000, 56)).toEqual({ left: 580, width: 420 });
    expect(layoutBox("fill", 1000, 56)).toEqual({ left: 56, width: 944 });
  });

  it("luminance and dark probes", () => {
    expect(luminanceOf("rgb(0, 0, 0)")).toBeCloseTo(0, 3);
    expect(luminanceOf("rgba(255, 255, 255, 0)")).toBeNull();
    expect(isDarkFromProbes(["rgb(10, 10, 10)"])).toBe(true);
    expect(isDarkFromProbes(["rgb(250, 250, 250)"])).toBe(false);
    expect(escapeHtml(`<a "b">`)).toBe("&lt;a &quot;b&quot;&gt;");
    expect(clampCardStyle("hero")).toBe("hero");
    expect(clampCardStyle("nope")).toBe("stamp");
  });
});
