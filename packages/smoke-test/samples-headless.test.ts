import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createDshAdapter } from "@monkey-mini-app/adapter-dsh";
import { getHelloTemplateFiles } from "@monkey-mini-app/agent-skills";
import { renderTabBarText } from "@monkey-mini-app/ui-core";

async function makeRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "mma-samples-"));
}

describe("headless real samples", () => {
  it("registers hello + counter samples, multi-tab UI, storage, history tree", async () => {
    const root = await makeRoot();
    const adapter = await createDshAdapter({
      runtimeRoot: root,
      hostHandlers: {
        getUser: async () => ({ id: "u1", name: "SampleUser" }),
      },
    });

    expect(adapter.skillMarkdown).toContain("monkey-mini-app");
    expect(adapter.tools.length).toBeGreaterThan(5);

    // --- sample: hello from skill template ---
    const helloFiles = getHelloTemplateFiles();
    await adapter.invoke("mini_app_register", {
      appId: "com.example.hello",
      files: helloFiles,
    });

    // --- sample: counter with multi-file storage ---
    await adapter.invoke("mini_app_register", {
      appId: "com.example.counter",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.counter",
          name: "Counter",
          version: "0.1.0",
          entry: "App.tsx",
          permissions: ["storage", "ui", "host:getUser"],
        }),
        "App.tsx": `export default function App(){ return null }`,
        "main.api.ts": `export {}`,
      },
    });

    const list = (await adapter.invoke("mini_app_list", {})) as {
      apps: { id: string }[];
    };
    expect(list.apps.map((a) => a.id).sort()).toEqual([
      "com.example.counter",
      "com.example.hello",
    ]);

    // bridge storage on counter
    const { mini, dispose } = adapter.runtime.openBridge("com.example.counter");
    await mini.storage.set("count", 3, { file: "default.json" });
    await mini.storage.set("label", "clicks", { file: "settings.json" });
    expect((await mini.storage.get("count")).value).toBe(3);
    expect((await mini.storage.get("label", { file: "settings.json" })).value).toBe(
      "clicks"
    );
    const user = (await mini.host.invoke("getUser")) as { name: string };
    expect(user.name).toBe("SampleUser");
    dispose();

    // files on disk under runtime root
    const settingsPath = path.join(
      root,
      "apps/com.example.counter/storage/settings.json"
    );
    const raw = await fs.readFile(settingsPath, "utf8");
    expect(JSON.parse(raw).label).toBe("clicks");

    // history
    const appDir = path.join(root, "apps/com.example.counter");
    await fs.writeFile(path.join(appDir, "note.txt"), "v1");
    const c1 = (await adapter.invoke("mini_app_history_commit", {
      appId: "com.example.counter",
      message: "v1",
    })) as { commitId: string };
    await fs.writeFile(path.join(appDir, "note.txt"), "v2");
    const c2 = (await adapter.invoke("mini_app_history_commit", {
      appId: "com.example.counter",
      message: "v2",
    })) as { commitId: string };
    await adapter.invoke("mini_app_history_reset", {
      appId: "com.example.counter",
      commitId: c1.commitId,
    });
    const tree = (await adapter.invoke("mini_app_history_list", {
      appId: "com.example.counter",
    })) as { head: string; nodes: { id: string }[] };
    expect(tree.head).toBe(c1.commitId);
    expect(tree.nodes.some((n) => n.id === c2.commitId)).toBe(true);

    // multi-tab UI
    await adapter.ui.openTab("com.example.hello", "Hello");
    await adapter.ui.openTab("com.example.counter", "Counter");
    let st = adapter.ui.getState();
    expect(st.tabs).toHaveLength(2);
    expect(st.activeTabId).toBeTruthy();
    const first = st.tabs[0]!.tabId;
    await adapter.ui.focusTab(first);
    st = adapter.ui.getState();
    expect(st.activeTabId).toBe(first);
    const bar = renderTabBarText(st);
    expect(bar).toMatch(/\*Hello|Hello/);
    expect(bar).toContain("Counter");

    // theme
    await adapter.ui.setTheme("dark");
    expect(adapter.ui.getState().themeId).toBe("dark");
    const tokens = adapter.runtime.applyThemeTokens();
    expect(tokens["color-background"] || tokens["color-foreground"]).toBeTruthy();
  }, 60_000);
});
