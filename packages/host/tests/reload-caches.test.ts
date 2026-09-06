import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  AppCssCompiler,
  AppsManager,
  bootstrapHostConfig,
  GitHistory,
  type ReloadResult,
  UiCompiler,
  WorkspacePaths,
} from "@monkey-mini-app/host";

/**
 * `mini_app_reload` is the tool an agent uses to answer "did my change take effect?", so the
 * result has to state what the host threw away instead of leaving the agent to infer it from a
 * screenshot. Before this, a reload could report `ok: true` while the process kept serving a CSS
 * build from before the edit — the agent's only clue was the app looking subtly wrong.
 */

const APP = "com.example.reload";

function boot(): { apps: AppsManager; dir: string; cacheRoot: string } {
  const config = bootstrapHostConfig({ runtimeRoot: mkdtempSync(path.join(tmpdir(), "mma-reload-")), hostPort: 0 });
  const paths = new WorkspacePaths(config.runtimeRoot);
  const git = new GitHistory();
  const apps = new AppsManager(paths, {}, git, config);
  apps.setUiCompiler(new UiCompiler(paths));
  apps.setCssCompiler(new AppCssCompiler(paths));
  return { apps, dir: apps.dirOf(APP), cacheRoot: paths.uiCacheDir() };
}

let apps: AppsManager;
let dir: string;
let cacheRoot: string;

beforeEach(async () => {
  const h = boot();
  apps = h.apps;
  dir = h.dir;
  cacheRoot = h.cacheRoot;
  await apps.register(APP, {
    "manifest.json": JSON.stringify({ id: APP, name: "Reload", version: "1.0.0", entry: "ui.tsx" }),
    "ui.tsx": `export default function Ui() {
  return <div className="w-[437px]">box</div>;
}
`,
    "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({ name: "Reload", description: "d", api: { ping: async () => "pong" } });
`,
  });
});

/** Plant the artifacts a previous build would have left behind. */
function plantStaleOutput(): { css: string; bundleDir: string; other: string } {
  const autogen = path.join(dir, ".autogen");
  mkdirSync(autogen, { recursive: true });
  const css = path.join(autogen, "ui.css");
  writeFileSync(css, ".stale{color:red}", "utf8");

  // Same shape `UiCompiler` writes: app id with its dots filtered out, then the source signature.
  const bundleDir = path.join(cacheRoot, `${APP.replace(/[^A-Za-z0-9_-]/g, "_")}-1700000000000-1`);
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(path.join(bundleDir, "entry.js"), "// stale bundle", "utf8");
  const other = path.join(cacheRoot, "com_example_other-1700000000000-1");
  mkdirSync(other, { recursive: true });
  writeFileSync(path.join(other, "entry.js"), "// other app", "utf8");
  return { css, bundleDir, other };
}

function cachesOf(result: unknown): ReloadResult["caches"] {
  return (result as ReloadResult).caches;
}

describe("mini_app_reload cache report", () => {
  it("says which memos were dropped and who was told to re-fetch", async () => {
    const { css } = plantStaleOutput();
    const result = await apps.reload(APP);

    expect(result.ok).toBe(true);
    expect(cachesOf(result)).toMatchObject({ uiBundle: "dropped", appCss: "dropped" });
    // Nothing attached to the bus, so the honest answer is "nobody was shown this app" — not a
    // silent claim that a view refreshed.
    expect(cachesOf(result)?.views).toMatch(/no panel attached/);
    // On-disk output survives an ordinary reload: only the memos are guaranteed gone.
    expect(existsSync(css)).toBe(true);
    expect(cachesOf(result)?.diskBundles).toBeUndefined();
  });

  it("cleanCaches also removes the on-disk build output", async () => {
    const { css, bundleDir, other } = plantStaleOutput();
    const result = await apps.reload(APP, { cleanCaches: true });

    expect(result.ok).toBe(true);
    expect(cachesOf(result)).toMatchObject({ uiBundle: "dropped", appCss: "dropped", autogen: "removed" });
    expect(cachesOf(result)?.diskBundles).toBeGreaterThanOrEqual(1);
    expect(existsSync(css)).toBe(false);
    expect(existsSync(bundleDir)).toBe(false);
    // Only this app's entries: a purge must not evict a neighbour's warm cache.
    expect(existsSync(other)).toBe(true);
    expect(existsSync(path.join(dir, ".autogen"))).toBe(false);
  });

  it("reports that no refresh was sent when the compile is broken", async () => {
    writeFileSync(path.join(dir, "main.api.ts"), "export default { api: ", "utf8");
    const result = await apps.reload(APP);

    expect(result.ok).toBe(false);
    expect(cachesOf(result)?.views).toMatch(/not sent \(compile failed\)/);
    // The memos still went, so the next attempt cannot inherit a build from before the edit.
    expect(cachesOf(result)).toMatchObject({ uiBundle: "dropped", appCss: "dropped" });
  });
});
