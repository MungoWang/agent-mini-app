// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { FrameController, loadingMarkup } from "../src/client/frame.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FrameController", () => {
  it("renders loading markup and mounts / reloads / unmounts iframes", () => {
    const frames = document.createElement("div");
    frames.id = "mma-frames";
    document.body.appendChild(frames);
    const ctl = new FrameController(
      () => ({ theme: "dark", palette: "tokyo", dock: "side" }),
      () => "http://127.0.0.1:17880",
    );
    expect(loadingMarkup()).toContain("mma-load");
    ctl.mount("com.example.todo", `Todo & Co`);
    expect(ctl.map.size).toBe(1);
    const iframe = frames.querySelector("iframe");
    expect(iframe?.getAttribute("title")).toBe("Todo & Co");
    expect(frames.innerHTML).toContain("Todo &amp; Co");
    expect(iframe?.src).toContain("/app/com.example.todo");
    ctl.mount("com.example.todo");
    expect(ctl.map.get("com.example.todo")?.wrap.style.display).toBe("flex");
    ctl.mount("com.example.other");
    expect(ctl.map.size).toBe(2);
    expect(ctl.map.get("com.example.todo")?.wrap.style.display).toBe("none");
    ctl.reload("com.example.todo");
    expect(frames.querySelectorAll(".mma-load").length).toBeGreaterThan(0);
    iframe?.dispatchEvent(new Event("load"));
    ctl.postEnv("missing");
    ctl.postEnvAll();
    ctl.unmount("com.example.todo");
    expect(ctl.map.has("com.example.todo")).toBe(false);
    ctl.unmountAll();
    expect(ctl.map.size).toBe(0);
  });

  it("no-ops mount when #mma-frames is missing", () => {
    const ctl = new FrameController(
      () => ({ theme: "light", palette: "default", dock: "fill" }),
      () => "http://127.0.0.1:9",
    );
    ctl.mount("com.example.todo");
    expect(ctl.map.size).toBe(0);
  });
});
