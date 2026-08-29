import { describe, it, expect, vi } from "vitest";
import { httpRequest } from "./ctx-http.js";

describe("ctx.http abort propagation", () => {
  it("aborts immediately when the host signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const globalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as any;
    try {
      await expect(httpRequest("https://example.com/x", { signal: ac.signal })).rejects.toThrow();
    } finally {
      globalThis.fetch = globalFetch;
    }
    expect(globalThis.fetch).toBe(globalFetch);
  });
});
