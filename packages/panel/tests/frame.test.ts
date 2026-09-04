// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { createFrameController } from "@monkey-mini-app/panel";

afterEach(() => {
  document.body.innerHTML = "";
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.id = "mma-frames";
  document.body.appendChild(el);
  return el;
}

const env = { theme: "dark", palette: "tokyo", dock: "side" };

describe("createFrameController", () => {
  it("mounts / reloads / unmounts iframes and posts env", () => {
    const container = makeContainer();
    const ctl = createFrameController({
      container,
      urlOf: (id) => `http://127.0.0.1:17880/app/${encodeURIComponent(id)}?theme=${env.theme}&palette=${env.palette}&dock=${env.dock}`,
      envOf: () => env,
    });
    ctl.mount("com.example.todo", "Todo & Co");
    expect(ctl.map.size).toBe(1);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("title")).toBe("Todo & Co");
    expect(container.innerHTML).toContain("Todo &amp; Co");
    expect(iframe?.src).toContain("/app/com.example.todo");
    ctl.mount("com.example.todo");
    expect(ctl.map.get("com.example.todo")?.wrap.style.display).toBe("flex");
    ctl.mount("com.example.other");
    expect(ctl.map.size).toBe(2);
    expect(ctl.map.get("com.example.todo")?.wrap.style.display).toBe("none");
    ctl.reload("com.example.todo");
    expect(container.querySelectorAll(".mma-load").length).toBeGreaterThan(0);
    iframe?.dispatchEvent(new Event("load"));
    ctl.postEnv("missing");
    ctl.postEnvAll();
    ctl.unmount("com.example.todo");
    expect(ctl.map.has("com.example.todo")).toBe(false);
    ctl.unmountAll();
    expect(ctl.map.size).toBe(0);
  });

  it("binds the container lazily via setContainer", () => {
    const ctl = createFrameController({
      urlOf: (id) => `http://127.0.0.1:17880/app/${id}`,
      envOf: () => env,
    });
    ctl.mount("com.example.todo");
    expect(ctl.map.size).toBe(0); // no container yet
    const container = makeContainer();
    ctl.setContainer(container);
    ctl.mount("com.example.todo");
    expect(ctl.map.size).toBe(1);
  });

  it("relays a view query into the iframe, addressed to the host origin", () => {
    const container = makeContainer();
    const posted: Array<{ msg: unknown; target: string }> = [];
    const ctl = createFrameController({
      container,
      urlOf: (id) => `http://127.0.0.1:17880/app/${id}`,
      envOf: () => env,
    });
    ctl.mount("com.example.todo");
    const iframe = container.querySelector("iframe") as HTMLIFrameElement & {
      contentWindow: { postMessage(m: unknown, t: string): void } | null;
    };
    // jsdom gives an unattached iframe no contentWindow, so stand in for the real one.
    const win = { postMessage: (msg: unknown, target: string) => posted.push({ msg, target }) };
    Object.defineProperty(iframe, "contentWindow", { value: win, configurable: true });

    expect(
      ctl.postViewEval({ requestId: "v1", appId: "com.example.todo", code: "return 1", maxBytes: 512 }),
    ).toBe(true);
    expect(posted[0].msg).toMatchObject({ type: "mma-view-eval", requestId: "v1", code: "return 1" });
    // "*" would leak the payload to whatever the frame navigated to; name the host instead.
    expect(posted[0].target).toBe("http://127.0.0.1:17880");

    ctl.unmount("com.example.todo");
    expect(ctl.postViewEval({ requestId: "v2", appId: "com.example.todo" })).toBe(false);
  });

  it("addresses mma-set-env at the host origin too", () => {
    const container = makeContainer();
    const targets: string[] = [];
    const ctl = createFrameController({
      container,
      urlOf: (id) => `http://127.0.0.1:17880/app/${id}`,
      envOf: () => env,
    });
    ctl.mount("com.example.todo");
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const win = { postMessage: (_m: unknown, t: string) => targets.push(t) };
    Object.defineProperty(iframe, "contentWindow", { value: win, configurable: true });
    ctl.postEnv("com.example.todo");
    expect(targets).toEqual(["http://127.0.0.1:17880"]);
  });

  it("computes urls via urlOf", () => {
    const ctl = createFrameController({
      urlOf: (id) => `http://127.0.0.1:17880/app/${id}`,
      envOf: () => env,
    });
    expect(ctl.url("com.example.todo")).toBe("http://127.0.0.1:17880/app/com.example.todo");
  });
});
