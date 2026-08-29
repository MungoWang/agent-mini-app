import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createRuntime } from "./index.js";
import { createNodeHostPort } from "../node-fs.js";
import { createGitHistoryAdapter } from "../git.js";

describe("runtime-core", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "mma-rt-"));
  });

  async function boot() {
    const host = createNodeHostPort({ runtimeRoot: root });
    const history = createGitHistoryAdapter();
    return createRuntime({ host, history, themeId: "light" });
  }

  it("registers app, storage, theme, history", async () => {
    const rt = await boot();
    await rt.registerAppFromFiles("com.example.hello", {
      "manifest.json": JSON.stringify({
        id: "com.example.hello",
        name: "Hello",
        version: "0.0.1",
        entry: "App.tsx",
        permissions: ["storage", "ui"],
      }),
      "App.tsx": "export default function App(){return null}",
    });

    const apps = await rt.listApps();
    expect(apps.some((a) => a.id === "com.example.hello")).toBe(true);

    const { mini, dispose } = rt.openBridge("com.example.hello");
    await mini.storage.set("greeting", "hi");
    const got = await mini.storage.get("greeting");
    expect(got.value).toBe("hi");

    const storePath = path.join(
      root,
      "apps/com.example.hello/storage/default.json"
    );
    const disk = JSON.parse(await fs.readFile(storePath, "utf8"));
    expect(disk.greeting).toBe("hi");

    expect(await rt.getTheme()).toBe("light");
    await rt.setTheme("dark");
    expect(await rt.getTheme()).toBe("dark");
    const tokens = rt.applyThemeTokens();
    expect(tokens["color-background"]).toBeTruthy();

    const themeFromMini = (await mini.call("theme.get")) as {
      themeId: string;
    };
    expect(themeFromMini.themeId).toBe("dark");

    dispose();
  });

  it("denies storage without permission", async () => {
    const rt = await boot();
    await rt.registerAppFromFiles("com.example.noperm", {
      "manifest.json": JSON.stringify({
        id: "com.example.noperm",
        name: "No",
        version: "0.0.1",
        entry: "App.tsx",
        permissions: ["ui"], // 显式声明权限但无 storage → storage.get 应拒绝（空数组 = 全部允许）
      }),
      "App.tsx": "export default function App(){return null}",
    });
    const { mini, dispose } = rt.openBridge("com.example.noperm");
    await expect(mini.storage.get("x")).rejects.toThrow(/permission/i);
    dispose();
  });
});
