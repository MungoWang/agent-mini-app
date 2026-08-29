import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createRuntime,
  createNodeHostPort,
  createGitHistoryAdapter,
  createAgentHandlers,
  listAgentTools,
  invokeAgentTool,
  defaultResolveAppDir,
  createUiCore,
  renderTabBarText,
} from "@monkey-mini-app/host-core";

function skillRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "dsh-plugin", "skills", "monkey-mini-app");
}

function getHelloTemplateFiles(): Record<string, string> {
  const base = path.join(skillRoot(), "templates", "hello");
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, rel);
      else out[rel] = readFileSync(full, "utf8");
    }
  };
  walk(base, "");
  return out;
}

async function makeRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "mma-samples-"));
}

describe("headless real samples", () => {
  it("registers hello + counter samples, multi-tab UI, storage, history tree", async () => {
    const root = await makeRoot();
    const host = createNodeHostPort({
      runtimeRoot: root,
      hostHandlers: {
        getUser: async () => ({ id: "u1", name: "SampleUser" }),
      },
    });
    const history = createGitHistoryAdapter();
    const runtime = await createRuntime({
      host,
      history,
      themeId: "light",
    });
    const handlers = createAgentHandlers({
      runtime,
      runtimeRoot: root,
      resolveAppDir: (id) => defaultResolveAppDir(root, id),
    });
    const ui = createUiCore(runtime);
    await ui.refresh();
    const invoke = (name: string, input?: Record<string, unknown>) =>
      invokeAgentTool(handlers, name, input ?? {});

    const skillMarkdown = readFileSync(path.join(skillRoot(), "SKILL.md"), "utf8");
    expect(skillMarkdown).toContain("monkey-mini-app");
    expect(listAgentTools().length).toBeGreaterThan(5);

    // --- sample: hello from skill template ---
    const helloFiles = getHelloTemplateFiles();
    await invoke("mini_app_register", {
      appId: "com.example.hello",
      files: helloFiles,
    });

    // --- sample: counter with multi-file storage ---
    await invoke("mini_app_register", {
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

    const list = (await invoke("mini_app_list", {})) as {
      apps: { id: string }[];
    };
    expect(list.apps.map((a) => a.id).sort()).toEqual([
      "com.example.counter",
      "com.example.hello",
    ]);

    // bridge storage on counter
    const { mini, dispose } = runtime.openBridge("com.example.counter");
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
    const c1 = (await invoke("mini_app_history_commit", {
      appId: "com.example.counter",
      message: "v1",
    })) as { commitId: string };
    await fs.writeFile(path.join(appDir, "note.txt"), "v2");
    const c2 = (await invoke("mini_app_history_commit", {
      appId: "com.example.counter",
      message: "v2",
    })) as { commitId: string };
    await invoke("mini_app_history_reset", {
      appId: "com.example.counter",
      commitId: c1.commitId,
    });
    const tree = (await invoke("mini_app_history_list", {
      appId: "com.example.counter",
    })) as { head: string; nodes: { id: string }[] };
    expect(tree.head).toBe(c1.commitId);
    expect(tree.nodes.some((n) => n.id === c2.commitId)).toBe(true);

    // multi-tab UI
    await ui.openTab("com.example.hello", "Hello");
    await ui.openTab("com.example.counter", "Counter");
    let st = ui.getState();
    expect(st.tabs).toHaveLength(2);
    expect(st.activeTabId).toBeTruthy();
    const first = st.tabs[0]!.tabId;
    await ui.focusTab(first);
    st = ui.getState();
    expect(st.activeTabId).toBe(first);
    const bar = renderTabBarText(st);
    expect(bar).toMatch(/\*Hello|Hello/);
    expect(bar).toContain("Counter");

    // theme
    await ui.setTheme("dark");
    expect(ui.getState().themeId).toBe("dark");
    const tokens = runtime.applyThemeTokens();
    expect(tokens["color-background"] || tokens["color-foreground"]).toBeTruthy();
  }, 60_000);
});
