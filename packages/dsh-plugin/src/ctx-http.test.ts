import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTP_MAX_BYTES, httpRequest } from "./ctx-http.js";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers });
}

describe("ctx.http", () => {
  it("GETs a URL shorthand and parses JSON", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      expect(String(input)).toBe("https://api.example.com/ping");
      return jsonResponse({ ok: true });
    }) as typeof fetch;
    const r = await httpRequest("https://api.example.com/ping");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
    expect(r.text).toContain("ok");
  });

  it("appends query, JSON-encodes object body, and sets a UA", async () => {
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      expect(url).toContain("q=hello");
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toBe(JSON.stringify({ n: 1 }));
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toMatch(/json/i);
      expect(headers.get("user-agent")).toMatch(/monkey-mini-app/);
      return jsonResponse({ saved: true }, { status: 201 });
    }) as typeof fetch;
    const r = await httpRequest("https://api.example.com/items", {
      method: "POST",
      query: { q: "hello" },
      body: { n: 1 },
    });
    expect(r.status).toBe(201);
    expect(r.json).toEqual({ saved: true });
  });

  it("leaves XML as text and json=null", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("<rss><item><title>Hi</title></item></rss>", {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        })
    ) as typeof fetch;
    const r = await httpRequest("https://news.ycombinator.com/rss");
    expect(r.ok).toBe(true);
    expect(r.json).toBeNull();
    expect(r.text).toContain("<title>Hi</title>");
  });

  it("returns ok:false on HTTP errors instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ err: "nope" }, { status: 404 })) as typeof fetch;
    const r = await httpRequest("https://api.example.com/missing");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.json).toEqual({ err: "nope" });
  });

  it("rejects non-http schemes and empty urls", async () => {
    await expect(httpRequest("file:///etc/passwd")).rejects.toThrow(/only http/);
    await expect(httpRequest("")).rejects.toThrow(/url required/);
  });

  it("maps abort to timeout", async () => {
    globalThis.fetch = vi.fn(async () => {
      const e = new Error("The operation was aborted due to timeout");
      e.name = "TimeoutError";
      throw e;
    }) as typeof fetch;
    await expect(httpRequest("https://api.example.com/slow", { timeout: 10 })).rejects.toThrow(/timeout/);
  });

  it("rejects oversized payloads", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": String(HTTP_MAX_BYTES + 1) },
        })
    ) as typeof fetch;
    await expect(httpRequest("https://api.example.com/huge")).rejects.toThrow(/too large/);
  });
});
