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

  it("computes urls via urlOf", () => {
    const ctl = createFrameController({
      urlOf: (id) => `http://127.0.0.1:17880/app/${id}`,
      envOf: () => env,
    });
    expect(ctl.url("com.example.todo")).toBe("http://127.0.0.1:17880/app/com.example.todo");
  });
});
