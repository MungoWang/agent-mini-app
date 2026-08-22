import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createRuntime } from "@monkey-mini-app/runtime-core";
import { createNodeHostPort } from "@monkey-mini-app/adapter-node";
import { createGitHistoryAdapter } from "@monkey-mini-app/app-history-git";
import { createHistory } from "@monkey-mini-app/app-history";

describe("smoke: end-to-end runtime", () => {
  it("full path: register → storage → history reset tree → host invoke", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mma-smoke-"));
    const host = createNodeHostPort({
      runtimeRoot: root,
      hostHandlers: {
        getUser: async () => ({ id: "u1", name: "Ada" }),
      },
    });
    const history = createHistory(createGitHistoryAdapter());
    const rt = await createRuntime({ host, history });

    await rt.registerAppFromFiles("com.smoke.demo", {
      "manifest.json": JSON.stringify({
        id: "com.smoke.demo",
        name: "Smoke",
        version: "1.0.0",
        entry: "App.tsx",
        permissions: ["storage", "ui", "host:getUser"],
      }),
      "App.tsx": "// smoke",
      "notes.txt": "v1",
    });

    const { mini, dispose } = rt.openBridge("com.smoke.demo");

    await mini.storage.set("n", 1, { file: "settings.json" });
    expect((await mini.storage.get("n", { file: "settings.json" })).value).toBe(
      1
    );
    const files = await mini.storage.listFiles();
    expect(files.files).toContain("settings.json");

    const user = (await mini.host.invoke("getUser")) as { name: string };
    expect(user.name).toBe("Ada");

    const appDir = path.join(root, "apps/com.smoke.demo");
    await fs.writeFile(path.join(appDir, "notes.txt"), "v2");
    const c1 = await rt.historyCommit("com.smoke.demo", "v2 notes");
    await fs.writeFile(path.join(appDir, "notes.txt"), "v3");
    const c2 = await rt.historyCommit("com.smoke.demo", "v3 notes");
    expect(c2.commitId).not.toBe(c1.commitId);

    const { backupRef } = await rt.historyResetTo(
      "com.smoke.demo",
      c1.commitId
    );
    expect(backupRef).toBeTruthy();
    const tree = await rt.historyList("com.smoke.demo");
    expect(tree.head).toBe(c1.commitId);
    expect(tree.nodes.some((n) => n.id === c2.commitId)).toBe(true);

    dispose();
  }, 30_000);
});
