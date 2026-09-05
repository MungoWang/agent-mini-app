import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type AppCallContext,
  AppsManager,
  asAppId,
  bootstrapHostConfig,
  GitHistory,
  type HostCapabilities,
  type HostConfig,
  HostError,
  parseManifest,
  WorkspacePaths,
} from "@monkey-mini-app/host";

function boot(caps: HostCapabilities = {}): {
  root: string;
  config: HostConfig;
  paths: WorkspacePaths;
  git: GitHistory;
  apps: AppsManager;
} {
  const root = mkdtempSync(path.join(tmpdir(), "mma-apps-"));
  const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
  const paths = new WorkspacePaths(config.runtimeRoot);
  const git = new GitHistory();
  const apps = new AppsManager(paths, caps, git, config);
  return { root, config, paths, git, apps };
}

function appSource(body: string): string {
  return `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Fixture",
  description: "fixture app",
  api: {
    ${body}
  },
});
`;
}

describe("parseManifest", () => {
  it("parses a complete manifest and defaults permissions", () => {
    const m = parseManifest(
      JSON.stringify({
        id: "com.example.todo",
        name: "Todo",
        version: "0.1.0",
        entry: "ui.tsx",
        description: "local todos",
      }),
    );
    expect(m.id).toBe("com.example.todo");
    expect(m.name).toBe("Todo");
    expect(m.version).toBe("0.1.0");
    expect(m.entry).toBe("ui.tsx");
    expect(m.description).toBe("local todos");
    expect(m.permissions).toEqual([]);
  });

  it("rejects missing required fields and invalid ids", () => {
    expect(() => parseManifest("{")).toThrow(HostError);
    expect(() => parseManifest(JSON.stringify({ name: "X" }))).toThrow(HostError);
    expect(() =>
      parseManifest(
        JSON.stringify({ id: "todo", name: "X", version: "1", entry: "ui.tsx" }),
      ),
    ).toThrow(HostError);
  });
});

describe("AppsManager", () => {
  it("lists nothing when the apps dir is missing", async () => {
    const { apps } = boot();
    expect(await apps.list()).toEqual([]);
  });

  it("registers files, lists the app, and resolves dirOf", async () => {
    const { apps, paths } = boot();
    const app = await apps.register("com.example.todo", {
      "manifest.json": JSON.stringify({
        id: "com.example.todo",
        name: "Todo",
        version: "0.1.0",
        entry: "ui.tsx",
        acronym: "TD",
      }),
      "ui.tsx": "export default function Ui() { return null }",
      "main.api.ts": appSource("ping: async (_ctx, args) => ({ ok: true, args }),"),
    });
    expect(app.id).toBe("com.example.todo");
    expect(app.name).toBe("Todo");
    expect(app.acronym).toBe("TD");
    expect(app.commits).toBeGreaterThan(0);

    const listed = await apps.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe("com.example.todo");
    expect(apps.dirOf("com.example.todo")).toBe(paths.appDir(asAppId("com.example.todo")));
  });

  it("rejects invalid app ids, missing manifests, and escaping file paths", async () => {
    const { apps } = boot();
    await expect(apps.register("todo", { "manifest.json": "{}" })).rejects.toThrow(HostError);
    await expect(
      apps.register("com.example.todo", { "ui.tsx": "x" }),
    ).rejects.toThrow(HostError);
    await expect(
      apps.register("com.example.todo", {
        "manifest.json": JSON.stringify({
          id: "com.example.todo",
          name: "Todo",
          version: "1",
          entry: "ui.tsx",
        }),
        "../escape.ts": "nope",
      }),
    ).rejects.toThrow(HostError);
  });

  it("skips unreadable or invalid app directories when listing", async () => {
    const { apps, paths } = boot();
    mkdirSync(paths.appsDir(), { recursive: true });
    mkdirSync(path.join(paths.appsDir(), "not-an-id"), { recursive: true });
    writeFileSync(path.join(paths.appsDir(), "not-an-id", "manifest.json"), "{}");
    writeFileSync(path.join(paths.appsDir(), "stray.txt"), "ignore me");
    expect(await apps.list()).toEqual([]);
  });

  it("calls a dashboard method and injects host capabilities into ctx", async () => {
    const bash = async (_ctx: AppCallContext, command: string) => ({
      stdout: `ran:${command}`,
      stderr: "",
      exitCode: 0,
    });
    const llm = async (_ctx: AppCallContext, prompt: string) => `llm:${prompt}`;
    const { apps } = boot({ bash, llm });
    await apps.register("com.example.echo", {
      "manifest.json": JSON.stringify({
        id: "com.example.echo",
        name: "Echo",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": appSource(`
        ping: async (ctx, args) => ({ ok: true, args, port: ctx.config.hostPort }),
        bash: async (ctx, args) => ctx.bash(String((args as { cmd: string }).cmd)),
        talk: async (ctx, args) => ctx.llm(String((args as { p: string }).p)),
        save: async (ctx, args) => {
          await ctx.storage.set("k", (args as { v: string }).v);
          return ctx.storage.get("k");
        },
      `),
    });

    await expect(apps.call("com.example.echo", "ping", { n: 2 })).resolves.toEqual({
      ok: true,
      args: { n: 2 },
      port: 0,
    });
    await expect(apps.call("com.example.echo", "bash", { cmd: "echo hi" })).resolves.toEqual({
      stdout: "ran:echo hi",
      stderr: "",
      exitCode: 0,
    });
    await expect(apps.call("com.example.echo", "talk", { p: "hello" })).resolves.toBe("llm:hello");
    await expect(apps.call("com.example.echo", "save", { v: "stored" })).resolves.toBe("stored");
  });

  it("exposes ctx.system.metrics and ctx.http on dashboard methods", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ pong: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      const { apps } = boot();
      await apps.register("com.example.sys", {
        "manifest.json": JSON.stringify({
          id: "com.example.sys",
          name: "Sys",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": appSource(`
          metrics: async (ctx) => ctx.system.metrics(),
          net: async (ctx) => ctx.http("https://example.com/ping"),
        `),
      });
      const metrics = (await apps.call("com.example.sys", "metrics", {})) as { cpu: { count: number } };
      expect(metrics.cpu.count).toBeGreaterThan(0);
      const net = (await apps.call("com.example.sys", "net", {})) as { json: { pong: boolean } };
      expect(net.json).toEqual({ pong: true });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("compiles TypeScript in main.api and relative helper imports", async () => {
    const { apps } = boot();
    await apps.register("com.example.ts", {
      "manifest.json": JSON.stringify({
        id: "com.example.ts",
        name: "TS",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "lib/math.ts": "export function double(n: number): number { return n * 2; }\n",
      "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";
import { double } from "./lib/math";
export default defineApp({
  name: "TS",
  description: "typed",
  api: {
    run: async (_ctx: unknown, args: { n: number }): Promise<{ n: number }> => {
      return { n: double(args.n) };
    },
  },
});
`,
    });
    await expect(apps.call("com.example.ts", "run", { n: 4 })).resolves.toEqual({ n: 8 });
  });

  it("accepts any in-app relative subfolder (folder names are convention, not allowlist)", async () => {
    const { apps } = boot();
    await apps.register("com.example.tree", {
      "manifest.json": JSON.stringify({
        id: "com.example.tree",
        name: "Tree",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "utils/triple.ts": "export const triple = (n: number): number => n * 3;\n",
      "api/wrap.ts": "import { triple } from \"../utils/triple\";\nexport const wrap = (n: number) => `=${triple(n)}`;\n",
      "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";
import { wrap } from "./api/wrap";
export default defineApp({
  name: "Tree",
  description: "folders",
  api: { run: async (_ctx, args: { n: number }) => wrap(args.n) },
});
`,
    });
    await expect(apps.call("com.example.tree", "run", { n: 3 })).resolves.toBe("=9");
  });

  it("rejects backend imports from the UI-only tree (ui/**)", async () => {
    const { apps } = boot();
    await apps.register("com.example.uitree", {
      "manifest.json": JSON.stringify({
        id: "com.example.uitree",
        name: "UiTree",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "ui/label.ts": "export const label = \"hello\";\n",
      "main.api.ts": `import { defineApp } from "@monkey-mini-app/api";
import { label } from "./ui/label";
export default defineApp({
  name: "UiTree",
  description: "crosses the line",
  api: { ping: async () => label },
});
`,
    });
    await expect(apps.call("com.example.uitree", "ping", {})).rejects.toThrow(/ui\/\*\* is UI-only/);
  });

  it("rejects the removed virtual dashboard module", async () => {
    const { apps } = boot();
    await apps.register("com.example.legacy", {
      "manifest.json": JSON.stringify({
        id: "com.example.legacy",
        name: "Legacy",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({
  name: "Legacy",
  description: "pre-unification",
  api: { ping: async () => 1 },
});
`,
    });
    await expect(apps.call("com.example.legacy", "ping", {})).rejects.toThrow(/@monkeyagent\/dashboard/);
  });

  it("rejects backend npm imports and unknown methods", async () => {
    const { apps } = boot();
    await apps.register("com.example.bad", {
      "manifest.json": JSON.stringify({
        id: "com.example.bad",
        name: "Bad",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": `import fs from "node:fs";
import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Bad",
  description: "nope",
  api: { ping: async () => fs.existsSync(".") },
});
`,
    });
    await expect(apps.call("com.example.bad", "ping", {})).rejects.toThrow(HostError);
    await apps.register("com.example.ok", {
      "manifest.json": JSON.stringify({
        id: "com.example.ok",
        name: "Ok",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": appSource("ping: async () => 1,"),
    });
    await expect(apps.call("com.example.ok", "missing", {})).rejects.toThrow(HostError);
  });

  it("injects full lodash into the backend", async () => {
    const { apps } = boot();
    await apps.register("com.example.lodash", {
      "manifest.json": JSON.stringify({
        id: "com.example.lodash",
        name: "Lodash",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "ui.tsx": "export default function Ui() { return null; }\n",
      "main.api.ts": `import { pick } from "lodash";
import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Lodash",
  description: "vendor",
  api: { ping: async () => pick({ a: 1, b: 2 }, "a") },
});
`,
    });
    await expect(apps.call("com.example.lodash", "ping", {})).resolves.toEqual({ a: 1 });
  });

  it("loads a backend package installed into the app directory", async () => {
    const { apps } = boot();
    const id = "com.example.vendor";
    await apps.register(id, {
      "manifest.json": JSON.stringify({ id, name: "Vendor", version: "1.0.0", entry: "ui.tsx" }),
      "ui.tsx": "export default function Ui() { return null; }\n",
      "main.api.ts": `import { stamp } from "fake-mma-lib";
import { defineApp } from "@monkey-mini-app/api";
export default defineApp({ name: "Vendor", description: "d", api: { ping: async () => stamp() } });
`,
    });
    // Not installed yet → the error must name the tool that fixes it.
    await expect(apps.call(id, "ping", {})).rejects.toThrow(/mini_app_install/);

    const dir = apps.dirOf(id);
    mkdirSync(path.join(dir, "node_modules", "fake-mma-lib"), { recursive: true });
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ private: true, name: id, version: "0.0.0", dependencies: { "fake-mma-lib": "^1.0.0" } }),
    );
    writeFileSync(
      path.join(dir, "node_modules", "fake-mma-lib", "package.json"),
      JSON.stringify({ name: "fake-mma-lib", version: "1.0.0", main: "index.js" }),
    );
    writeFileSync(
      path.join(dir, "node_modules", "fake-mma-lib", "index.js"),
      "module.exports = { stamp: () => 'from-app-node-modules' };\n",
    );
    apps.invalidate(String(dir));

    await expect(apps.call(id, "ping", {})).resolves.toBe("from-app-node-modules");
  });

  it("does not expose the host's own dependencies to a mini-app", async () => {
    const { apps } = boot();
    const id = "com.example.escape";
    await apps.register(id, {
      "manifest.json": JSON.stringify({ id, name: "Escape", version: "1.0.0", entry: "ui.tsx" }),
      "ui.tsx": "export default function Ui() { return null; }\n",
      // hono is a dependency of the host process itself, never of this app
      "main.api.ts": `import { Hono } from "hono";
import { defineApp } from "@monkey-mini-app/api";
export default defineApp({ name: "Escape", description: "d", api: { ping: async () => typeof Hono } });
`,
    });
    await expect(apps.call(id, "ping", {})).rejects.toThrow(/BACKEND_IMPORT|mini_app_install/);
  });

  it("throws when llm/bash capabilities are missing", async () => {
    const { apps } = boot();
    await apps.register("com.example.caps", {
      "manifest.json": JSON.stringify({
        id: "com.example.caps",
        name: "Caps",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": appSource("talk: async (ctx) => ctx.llm('hi'),"),
    });
    await expect(apps.call("com.example.caps", "talk", {})).rejects.toThrow(/llm/);
  });

  it("removes an app from disk and the list", async () => {
    const { apps } = boot();
    await apps.register("com.example.gone", {
      "manifest.json": JSON.stringify({
        id: "com.example.gone",
        name: "Gone",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "main.api.ts": appSource("ping: async () => 1,"),
    });
    await apps.remove("com.example.gone");
    expect(await apps.list()).toEqual([]);
    await expect(apps.call("com.example.gone", "ping", {})).rejects.toThrow(HostError);
  });

  it("get returns null for an unknown app", async () => {
    const { apps } = boot();
    expect(await apps.get("com.example.missing")).toBeNull();
  });
});
