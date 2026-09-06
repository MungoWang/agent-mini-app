import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AppsManager,
  bootstrapHostConfig,
  GitHistory,
  HostError,
  installAppPackages,
  readAppManifest,
  requireFromAppPackages,
  WorkspacePaths,
  writeAppManifest,
} from "@monkey-mini-app/host";

function appDirWith(packages: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mma-pkgs-"));
  mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  for (const [name, main] of Object.entries(packages)) {
    const p = path.join(dir, "node_modules", name);
    mkdirSync(p, { recursive: true });
    writeFileSync(
      path.join(p, "package.json"),
      JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
    );
    writeFileSync(path.join(p, "index.js"), main);
  }
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ private: true, name: "app", version: "0.0.0", dependencies: {} }),
  );
  return dir;
}

describe("requireFromAppPackages", () => {
  it("loads a package that lives in this app's node_modules", () => {
    const dir = appDirWith({ "fake-lib": "module.exports = { ping: () => 'from-fake-lib' };" });
    const mod = requireFromAppPackages(dir, "fake-lib") as { ping(): string };
    expect(mod.ping()).toBe("from-fake-lib");
  });

  it("names mini_app_install when the package is not there", () => {
    const dir = appDirWith({});
    expect(() => requireFromAppPackages(dir, "kafkajs")).toThrow(/mini_app_install/);
  });

  it("names mini_app_install when the app has no package.json at all", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-pkgs-none-"));
    let err: unknown;
    try {
      requireFromAppPackages(dir, "exceljs");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HostError);
    expect((err as HostError).code).toBe("BACKEND_IMPORT");
    expect((err as Error).message).toMatch(/mini_app_install/);
  });

  it("will not let the loader reach a platform package by going around the vendor table", () => {
    const dir = appDirWith({});
    // lodash-es is a real dependency of the host process; the denylist must stop it
    // here too, so an app cannot pin its own second copy.
    expect(() => requireFromAppPackages(dir, "lodash-es")).toThrow(/platform package/);
  });

  it("keeps the platform denylist out of reach", () => {
    const dir = appDirWith({});
    expect(() => requireFromAppPackages(dir, "react")).toThrow(/platform package/);
  });
});

describe("installAppPackages", () => {
  it("reads the current set without running npm when nothing is requested", async () => {
    const dir = appDirWith({});
    const out = await installAppPackages({ appDir: dir, appId: "com.example.a" });
    expect(out.ok).toBe(true);
    expect(out.noop).toBe(true);
    expect(out.dependencies).toEqual({});
  });

  for (const name of ["lodash", "lodash-es", "react", "react-dom", "axios", "typescript", "@monkey-mini-app/ui"]) {
    it(`rejects the platform package ${name}`, async () => {
      const dir = appDirWith({});
      await expect(
        installAppPackages({ appDir: dir, appId: "com.example.a", packages: [{ name }] }),
      ).rejects.toThrow(/platform package|already/);
    });
  }

  for (const name of ["motion", "framer-motion"]) {
    it(`rejects ${name} and points at the iframe motion build`, async () => {
      const dir = appDirWith({});
      // A second motion means a second React binding, so the refusal has to name the
      // specifier that actually works — "do not install it" alone sends the agent away.
      await expect(
        installAppPackages({ appDir: dir, appId: "com.example.a", packages: [{ name }] }),
      ).rejects.toThrow(/motion\/react/);
    });
  }

  it("rejects a path-ish package name", async () => {
    const dir = appDirWith({});
    await expect(
      installAppPackages({ appDir: dir, appId: "com.example.a", packages: [{ name: "../../etc/passwd" }] }),
    ).rejects.toThrow(/invalid package name/);
  });

  it("drops any scripts field so nothing of ours can execute a dependency hook", () => {
    const dir = appDirWith({});
    writeAppManifest(dir, "com.example.a", {
      private: true,
      name: "app",
      version: "0.0.0",
      dependencies: { ms: "^2" },
      scripts: { preinstall: "echo pwned" },
    } as unknown as NonNullable<ReturnType<typeof readAppManifest>> & Record<string, unknown>);
    const raw = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as Record<string, unknown>;
    expect(raw.scripts).toBeUndefined();
    expect((raw.dependencies as Record<string, string>).ms).toBe("^2");
    expect(raw.private).toBe(true);
  });

  it("is a no-op for npm when the caller requests nothing", async () => {
    const dir = appDirWith({});
    const out = await installAppPackages({ appDir: dir, appId: "com.example.a" });
    expect(out.noop).toBe(true);
    // no package.json churn beyond the fixture's own
    expect(readAppManifest(dir)?.dependencies).toEqual({});
  });
});

describe("AppsManager.installPackages", () => {
  function boot() {
    const root = mkdtempSync(path.join(tmpdir(), "mma-apps-pkgs-"));
    const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
    const paths = new WorkspacePaths(config.runtimeRoot);
    const apps = new AppsManager(paths, {}, new GitHistory(), config);
    return { apps };
  }

  it("does not churn the worktree for an empty request", async () => {
    const { apps } = boot();
    await apps.register("com.example.readonly", {
      "manifest.json": JSON.stringify({ id: "com.example.readonly", name: "R", version: "0.1.0", entry: "ui.tsx" }),
      "ui.tsx": "export default function Ui() { return null; }\n",
      "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";\nexport default defineApp({ name: "R", description: "d", api: { ping: async () => 1 } });\n`,
    });
    const out = await apps.installPackages("com.example.readonly", {});
    expect(out.ok).toBe(true);
    expect(out.noop).toBe(true);
    expect(out.committed.status).toBe("skipped");
  });

  it("refuses a platform package before touching npm", async () => {
    const { apps } = boot();
    await apps.register("com.example.deny", {
      "manifest.json": JSON.stringify({ id: "com.example.deny", name: "D", version: "0.1.0", entry: "ui.tsx" }),
      "ui.tsx": "export default function Ui() { return null; }\n",
      "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";\nexport default defineApp({ name: "D", description: "d", api: { ping: async () => 1 } });\n`,
    });
    await expect(
      apps.installPackages("com.example.deny", { packages: [{ name: "react" }] }),
    ).rejects.toThrow(/platform package/);
  });
});
