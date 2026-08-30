import { afterEach, describe, expect, it, vi } from "vitest";

import { HostError } from "@monkey-mini-app/host";

import { HTTP_MAX_BYTES, httpRequest } from "../src/apps/ctx-http.ts";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
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

  it("accepts a request object and skips null query values", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      expect(String(input)).toContain("keep=1");
      expect(String(input)).not.toContain("drop");
      return jsonResponse({ ok: true });
    }) as typeof fetch;
    const r = await httpRequest({
      url: "https://api.example.com/q",
      query: { keep: 1, drop: null, flag: true },
    });
    expect(r.ok).toBe(true);
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

  it("posts a raw string body without forcing JSON content-type", async () => {
    globalThis.fetch = vi.fn(async (_input, init) => {
      expect(String(init?.body)).toBe("plain");
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBeNull();
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }) as typeof fetch;
    const r = await httpRequest("https://api.example.com/plain", { method: "POST", body: "plain" });
    expect(r.json).toBeNull();
    expect(r.text).toBe("ok");
  });

  it("leaves XML as text and json=null", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("<rss><item><title>Hi</title></item></rss>", {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        }),
    ) as typeof fetch;
    const r = await httpRequest("https://news.ycombinator.com/rss");
    expect(r.ok).toBe(true);
    expect(r.json).toBeNull();
    expect(r.text).toContain("<title>Hi</title>");
  });

  it("returns json=null when JSON content-type is malformed", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    ) as typeof fetch;
    const r = await httpRequest("https://api.example.com/bad-json");
    expect(r.json).toBeNull();
    expect(r.text).toBe("not-json");
  });

  it("returns ok:false on HTTP errors instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ err: "nope" }, { status: 404 })) as typeof fetch;
    const r = await httpRequest("https://api.example.com/missing");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.json).toEqual({ err: "nope" });
  });

  it("rejects non-http schemes, empty urls, and unparseable urls", async () => {
    await expect(httpRequest("file:///etc/passwd")).rejects.toThrow(HostError);
    await expect(httpRequest("file:///etc/passwd")).rejects.toThrow(/only http/);
    await expect(httpRequest("")).rejects.toThrow(/url required/);
    await expect(httpRequest("   ")).rejects.toThrow(/url required/);
    await expect(httpRequest("http://")).rejects.toThrow(/invalid url/);
  });

  it("maps abort to cancelled and timeout errors to HTTP_TIMEOUT", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(httpRequest("https://api.example.com/x", { signal: ac.signal })).rejects.toThrow(/cancelled/);

    globalThis.fetch = vi.fn(async () => {
      const e = new Error("The operation was aborted due to timeout");
      e.name = "TimeoutError";
      throw e;
    }) as typeof fetch;
    await expect(httpRequest("https://api.example.com/slow", { timeout: 10 })).rejects.toThrow(/timeout/);
  });

  it("maps mid-flight abort to cancelled and other fetch failures to HTTP_FAILED", async () => {
    const ac = new AbortController();
    globalThis.fetch = vi.fn(async () => {
      ac.abort();
      throw new Error("aborted");
    }) as typeof fetch;
    await expect(httpRequest("https://api.example.com/x", { signal: ac.signal })).rejects.toThrow(/cancelled/);

    globalThis.fetch = vi.fn(async () => {
      throw new Error("dns fail");
    }) as typeof fetch;
    await expect(httpRequest("https://api.example.com/down")).rejects.toThrow(/dns fail/);
  });

  it("rejects oversized payloads by content-length and by body size", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": String(HTTP_MAX_BYTES + 1) },
        }),
    ) as typeof fetch;
    await expect(httpRequest("https://api.example.com/huge")).rejects.toThrow(/too large/);

    globalThis.fetch = vi.fn(
      async () =>
        new Response(Buffer.alloc(HTTP_MAX_BYTES + 1), {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    ) as typeof fetch;
    await expect(httpRequest("https://api.example.com/huge2")).rejects.toThrow(/too large/);
  });
});
