// @vitest-environment jsdom
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppRuntime, useApp } from "./use-app.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AppApi = ReturnType<typeof useApp>;

function Probe(props: { onApi: (api: AppApi) => void }) {
  props.onApi(useApp());
  return null;
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

  it("posts /api/call with appId from AppRuntime", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, value: { pong: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
    let api: AppApi | null = null;
    act(() => {
      root!.render(
        createElement(AppRuntime, {
          appId: "com.example.todo",
          children: createElement(Probe, { onApi: (next) => { api = next; } }),
        }),
      );
    });
    await expect(api!.call("ping", { n: 1 })).resolves.toEqual({ pong: true });
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
