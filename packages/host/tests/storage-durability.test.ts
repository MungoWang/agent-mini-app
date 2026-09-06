import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AppsManager,
  bootstrapHostConfig,
  GitHistory,
  type HostCapabilities,
  HostError,
  WorkspacePaths,
} from "@monkey-mini-app/host";

/**
 * `ctx.storage` is the only place a mini-app can lose user data, so the two rules here are about
 * failure modes rather than features:
 *
 * 1. a write is atomic — killing the process mid-`set` must leave the *previous* file readable;
 * 2. an unreadable file is loud — it used to read back as `{}`, so the next `set` silently
 *    replaced the whole table with one key and the app looked merely empty.
 */

const STORE = "com.example.store";

function boot(): { apps: AppsManager; file: string } {
  const root = mkdtempSync(path.join(tmpdir(), "mma-store-"));
  const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
  const apps = new AppsManager(new WorkspacePaths(config.runtimeRoot), {} as HostCapabilities, new GitHistory(), config);
  return { apps, file: path.join(apps.dirOf(STORE), "storage", "main.storage.json") };
}

async function withStore(): Promise<{ apps: AppsManager; file: string }> {
  const h = boot();
  await h.apps.register(STORE, {
    "manifest.json": JSON.stringify({ id: STORE, name: "Store", version: "1.0.0", entry: "ui.tsx" }),
    "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Store",
  description: "storage fixture",
  api: {
    put: async (ctx, args) => {
      const { k, v } = args as { k: string; v: string };
      await ctx.storage.set(k, v);
      return ctx.storage.get(k);
    },
    read: async (ctx, args) => ctx.storage.get(String((args as { k: string }).k)),
  },
});
`,
  });
  return h;
}

describe("ctx.storage durability", () => {
  it("keeps earlier keys across separate writes", async () => {
    const { apps } = await withStore();
    expect(await apps.call(STORE, "put", { k: "a", v: "1" })).toBe("1");
    expect(await apps.call(STORE, "put", { k: "b", v: "2" })).toBe("2");

    const stored = JSON.parse(readFileSync(path.join(apps.dirOf(STORE), "storage", "main.storage.json"), "utf8"));
    expect(stored).toMatchObject({ a: "1", b: "2" });
  });

  it("leaves no temp residue and a complete file behind every write", async () => {
    const { apps, file } = await withStore();
    await apps.call(STORE, "put", { k: "x", v: "y" });

    const dir = path.dirname(file);
    expect(readdirSync(dir).filter((n) => n.includes(".tmp-"))).toEqual([]);
    expect(() => JSON.parse(readFileSync(file, "utf8"))).not.toThrow();
  });

  it("refuses to read a corrupt table and keeps the bytes for recovery", async () => {
    const { apps, file } = await withStore();
    await apps.call(STORE, "put", { k: "precious", v: "user data" });

    // Simulate the aftermath of a truncated write.
    writeFileSync(file, '{"precious":"user dat', "utf8");

    const err = await apps.call(STORE, "read", { k: "precious" }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(HostError);
    expect((err as HostError).code).toBe("STORAGE_CORRUPT");

    // The bad content is preserved under a quarantine name, and the live path is clear so the
    // next write cannot quietly "fix itself" into a one-key table.
    expect(existsSync(file)).toBe(false);
    const kept = readdirSync(path.dirname(file)).filter((n) => n.includes(".corrupt-"));
    expect(kept).toHaveLength(1);
    expect(readFileSync(path.join(path.dirname(file), kept[0]), "utf8")).toBe('{"precious":"user dat');
  });

  it("treats a missing file as an empty store, not an error", async () => {
    const { apps } = await withStore();
    expect(await apps.call(STORE, "read", { k: "never-written" })).toBeNull();
  });
});
