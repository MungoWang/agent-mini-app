// @vitest-environment jsdom
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppRuntime, useApp, useDashboardApi } from "../src/use-app.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AppApi = ReturnType<typeof useApp>;

function Probe(props: { onApi: (api: AppApi) => void }) {
  props.onApi(useApp());
  return null;
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useApp", () => {
  let root: Root | null = null;
  let el: HTMLElement | null = null;
  const origFetch = globalThis.fetch;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    el?.remove();
    root = null;
    el = null;
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  function mount(node: ReturnType<typeof createElement>): void {
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root!.render(node);
    });
  }

  it("throws when call() runs outside AppRuntime", async () => {
    let api: AppApi | undefined;
    mount(createElement(Probe, { onApi: (next) => { api = next; } }));
    await expect(api!.call("ping")).rejects.toThrow(/AppRuntime/);
  });

  it("POSTs /api/call with appId, method, and args", async () => {
    const fetchMock = vi.fn(async () => jsonOk({ ok: true, value: { n: 1 } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    let api: AppApi | undefined;
    mount(
      createElement(AppRuntime, {
        appId: "com.example.todo",
        children: createElement(Probe, { onApi: (next) => { api = next; } }),
      }),
    );
    await expect(api!.call("ping", { n: 1 })).resolves.toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/call",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appId: "com.example.todo",
          method: "ping",
          args: { n: 1 },
        }),
      }),
    );
  });

  it("defaults missing args to {}", async () => {
    const fetchMock = vi.fn(async () => jsonOk({ ok: true, value: "ok" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    let api: AppApi | undefined;
    mount(
      createElement(AppRuntime, {
        appId: "com.example.todo",
        children: createElement(Probe, { onApi: (next) => { api = next; } }),
      }),
    );
    await expect(api!.call("list")).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/call",
      expect.objectContaining({
        body: JSON.stringify({
          appId: "com.example.todo",
          method: "list",
          args: {},
        }),
      }),
    );
  });

  it("throws the host error when ok is false", async () => {
    globalThis.fetch = vi.fn(async () => jsonOk({ ok: false, error: "nope" })) as unknown as typeof fetch;
    let api: AppApi | undefined;
    mount(
      createElement(AppRuntime, {
        appId: "com.example.todo",
        children: createElement(Probe, { onApi: (next) => { api = next; } }),
      }),
    );
    await expect(api!.call("ping")).rejects.toThrow("nope");
  });

  it("throws a generic error when the host omits error", async () => {
    globalThis.fetch = vi.fn(async () => jsonOk({ ok: false })) as unknown as typeof fetch;
    let api: AppApi | undefined;
    mount(
      createElement(AppRuntime, {
        appId: "com.example.todo",
        children: createElement(Probe, { onApi: (next) => { api = next; } }),
      }),
    );
    await expect(api!.call("ping")).rejects.toThrow("call failed");
  });

  it("keeps useDashboardApi as an alias of useApp", () => {
    expect(useDashboardApi).toBe(useApp);
  });
});
