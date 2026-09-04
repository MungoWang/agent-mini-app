import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AppsManager,
  bootstrapHostConfig,
  GitHistory,
  type HostConfig,
  HostError,
  type HostEvent,
  HostEventBus,
  ToolFacade,
  UiCompiler,
  WorkspacePaths,
} from "@monkey-mini-app/host";

function boot(): {
  config: HostConfig;
  paths: WorkspacePaths;
  git: GitHistory;
  apps: AppsManager;
  tools: ToolFacade;
  events: HostEventBus;
} {
  const root = mkdtempSync(path.join(tmpdir(), "mma-tools-"));
  const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
  const paths = new WorkspacePaths(config.runtimeRoot);
  const git = new GitHistory();
  const apps = new AppsManager(paths, {}, git, config);
  apps.setUiCompiler(new UiCompiler(paths));
  const events = new HostEventBus();
  const tools = new ToolFacade(apps, git, paths, events);
  return { config, paths, git, apps, tools, events };
}

const pingApi = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Ping",
  description: "ping",
  api: { ping: async (_ctx, args) => ({ ok: true, args }) },
});
`;

describe("ToolFacade", () => {
  it("exposes mini_app_* definitions with execute", () => {
    const { tools } = boot();
    const names = tools.definitions().map((t) => t.name);
    expect(names).toContain("mini_app_list");
    expect(names).toContain("mini_app_register");
    expect(names).toContain("mini_app_reload");
    expect(names).toContain("mini_app_list_files");
    expect(names).toContain("mini_app_read");
    expect(names).toContain("mini_app_edit");
    expect(names).toContain("mini_app_write");
    expect(names).toContain("mini_app_delete");
    expect(names).toContain("mini_app_open");
    expect(names).toContain("mini_app_call");
    expect(names).toContain("mini_app_history_list");
    expect(names).toContain("mini_app_history_commit");
    expect(names).toContain("mini_app_history_reset");
    expect(names).toContain("mini_app_history_revert");
    expect(names).not.toContain("mini_app_validate");
    for (const def of tools.definitions()) {
      expect(typeof def.execute).toBe("function");
      expect(def.inputSchema).toBeTypeOf("object");
    }
  });

  it("registers, lists, gets, and calls through invoke", async () => {
    const { tools, paths } = boot();
    const registered = (await tools.invoke("mini_app_register", {
      appId: "com.example.ping",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.ping",
          name: "Ping",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
      },
    })) as { ok: boolean; path: string; app: { id: string } };
    expect(registered.ok).toBe(true);
    expect(registered.app.id).toBe("com.example.ping");
    expect(registered.path).toBe(path.join(paths.appsDir(), "com.example.ping"));

    const listed = (await tools.invoke("mini_app_list", {})) as {
      apps: { id: string }[];
      runtimeRoot: string;
    };
    expect(listed.apps.some((a) => a.id === "com.example.ping")).toBe(true);
    expect(listed.runtimeRoot).toBe(paths.root);

    const got = (await tools.invoke("mini_app_get", { appId: "com.example.ping" })) as {
      ok: boolean;
    };
    expect(got.ok).toBe(true);

    const called = (await tools.invoke("mini_app_call", {
      appId: "com.example.ping",
      method: "ping",
      args: { n: 1 },
    })) as { ok: boolean; value: unknown };
    expect(called).toEqual({ ok: true, value: { ok: true, args: { n: 1 } } });
  });

  it("reload rejects a bad appId and execute matches invoke", async () => {
    const { tools } = boot();
    const bad = (await tools.invoke("mini_app_reload", { appId: "NotValid" })) as {
      ok: boolean;
      errors: string[];
    };
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);

    const def = tools.definitions().find((t) => t.name === "mini_app_reload");
    const viaExecute = (await def?.execute({ appId: "NotValid" })) as { ok: boolean };
    expect(viaExecute.ok).toBe(false);
  });

  it("reads, edits, writes, lists files; commit:false then reload commits dirty tree", async () => {
    const { tools, git, apps } = boot();
    const appId = "com.example.files";
    await tools.invoke("mini_app_register", {
      appId,
      files: {
        "manifest.json": JSON.stringify({
          id: appId,
          name: "Files",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
        "ui.tsx": `export default function App() {\n  return <div>hello</div>;\n}\n`,
      },
    });

    const listed = (await tools.invoke("mini_app_list_files", { appId })) as {
      ok: boolean;
      files: { path: string }[];
    };
    expect(listed.ok).toBe(true);
    expect(listed.files.map((f) => f.path)).toEqual(
      expect.arrayContaining(["manifest.json", "main.api.ts", "ui.tsx"]),
    );

    const read = (await tools.invoke("mini_app_read", { appId, path: "ui.tsx" })) as {
      ok: boolean;
      content: string;
      totalLines: number;
      startLine: number;
      endLine: number;
    };
    expect(read.ok).toBe(true);
    expect(read.content).toContain("hello");
    expect(read.totalLines).toBeGreaterThan(0);
    expect(read.startLine).toBe(1);
    expect(read.endLine).toBe(read.totalLines);

    const ranged = (await tools.invoke("mini_app_read", {
      appId,
      path: "ui.tsx",
      offset: 1,
      limit: 1,
      numbered: true,
    })) as { ok: boolean; content: string; startLine: number; endLine: number };
    expect(ranged.ok).toBe(true);
    expect(ranged.startLine).toBe(1);
    expect(ranged.endLine).toBe(1);
    expect(ranged.content).toMatch(/^1\|/);

    const edited = (await tools.invoke("mini_app_edit", {
      appId,
      path: "ui.tsx",
      edits: [{ oldText: "hello", newText: "world" }],
      commit: false,
    })) as { ok: boolean; diff?: string; committed: { status: string; note?: string } };
    expect(edited.ok).toBe(true);
    expect(edited.diff).toContain("world");
    // `commit: false` is an explicit opt-out, not "nothing to do" — the two used to
    // collapse into the same `null`.
    expect(edited.committed.status).toBe("skipped");
    expect(await git.isDirty(apps.dirOf(appId))).toBe(true);

    const written = (await tools.invoke("mini_app_write", {
      appId,
      path: "lib/note.ts",
      content: "export const note = 1;\n",
      commit: false,
    })) as { ok: boolean; created?: boolean };
    expect(written.ok).toBe(true);
    expect(written.created).toBe(true);

    const reloaded = (await tools.invoke("mini_app_reload", { appId })) as {
      ok: boolean;
      errors: string[];
      compiled?: { api: boolean; ui: boolean };
      committed?: { status: string; message?: string; note?: string };
    };
    expect(reloaded.errors).toEqual([]);
    expect(reloaded.ok).toBe(true);
    expect(reloaded.compiled?.api).toBe(true);
    expect(reloaded.compiled?.ui).toBe(true);
    expect(reloaded.committed?.status).toBe("committed");
    expect(reloaded.committed?.message).toBe("reload");
    expect(await git.isDirty(apps.dirOf(appId))).toBe(false);

    // A second reload has nothing to commit. `clean` must be distinguishable from
    // `skipped` (compile failed) and `failed` — an agent decides what to do next off this.
    const again = (await tools.invoke("mini_app_reload", { appId })) as {
      ok: boolean;
      committed?: { status: string };
    };
    expect(again.ok).toBe(true);
    expect(again.committed?.status).toBe("clean");

    const after = (await tools.invoke("mini_app_read", { appId, path: "ui.tsx" })) as {
      content: string;
    };
    expect(after.content).toContain("world");
  });

  it("edit fails loudly when oldText is missing", async () => {
    const { tools } = boot();
    const appId = "com.example.editfail";
    await tools.invoke("mini_app_register", {
      appId,
      files: {
        "manifest.json": JSON.stringify({
          id: appId,
          name: "Fail",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
        "ui.tsx": "export default function App() { return null }\n",
      },
    });
    const failed = (await tools.invoke("mini_app_edit", {
      appId,
      path: "ui.tsx",
      edits: [{ oldText: "nope-not-here", newText: "x" }],
    })) as { ok: boolean; error: string; code: string };
    expect(failed.ok).toBe(false);
    expect(failed.code).toBe("EDIT_FAILED");
    expect(failed.error).toMatch(/Could not find/);
  });

  it("commits and lists history for a registered app", async () => {
    const { tools } = boot();
    await tools.invoke("mini_app_register", {
      appId: "com.example.hist",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.hist",
          name: "Hist",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
        "note.txt": "v1",
      },
    });
    const committed = (await tools.invoke("mini_app_history_commit", {
      appId: "com.example.hist",
      message: "note",
    })) as { commitId: string };
    expect(committed.commitId).toHaveLength(40);

    const tree = (await tools.invoke("mini_app_history_list", {
      appId: "com.example.hist",
    })) as { head: string; nodes: { id: string }[] };
    expect(tree.head).toBe(committed.commitId);
    expect(tree.nodes.some((n) => n.id === committed.commitId)).toBe(true);
  });

  it("throws HostError for an unknown tool", async () => {
    const { tools } = boot();
    await expect(tools.invoke("mini_app_nope", {})).rejects.toThrow(HostError);
  });

  it("mini_app_open emits app:open and rejects missing apps", async () => {
    const { tools, events } = boot();
    await tools.invoke("mini_app_register", {
      appId: "com.example.open",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.open",
          name: "OpenMe",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
        "ui.tsx": "export default function Ui(){return null}",
      },
    });
    const seen: HostEvent[] = [];
    const unsub = events.subscribe((e) => seen.push(e));
    const opened = (await tools.invoke("mini_app_open", {
      appId: "com.example.open",
      title: "自定义标题",
    })) as { ok: boolean; appId: string; title: string; panel: string };
    expect(opened).toEqual({
      ok: true,
      appId: "com.example.open",
      title: "自定义标题",
      // The subscriber above is a connected panel, so the receipt is real.
      panel: "notified",
    });
    expect(seen).toEqual([{ type: "app:open", appId: "com.example.open", title: "自定义标题" }]);
    const missing = (await tools.invoke("mini_app_open", { appId: "com.missing.app" })) as {
      ok: boolean;
    };
    expect(missing.ok).toBe(false);
    unsub();
  });

  it("returns ok:false from mini_app_call when the method is missing", async () => {
    const { tools } = boot();
    await tools.invoke("mini_app_register", {
      appId: "com.example.ping",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.ping",
          name: "Ping",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
      },
    });
    const out = (await tools.invoke("mini_app_call", {
      appId: "com.example.ping",
      method: "missing",
    })) as { ok: boolean; error: string };
    expect(out.ok).toBe(false);
    expect(out.error).toBeTruthy();
  });
});

describe("ToolFacade.mini_app_errors", () => {
  it("returns what the iframe reported, newest cursor included", async () => {
    const { tools, events } = boot();
    events.reportAppError("com.example.err", {
      kind: "render",
      message: "greeting is not defined",
      componentStack: "\n    at Ui",
    });
    const res = (await tools.invoke("mini_app_errors", { appId: "com.example.err" })) as {
      ok: boolean;
      errors: { kind: string; message: string; componentStack?: string }[];
      lastSeq: number;
    };
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toMatchObject({
      kind: "render",
      message: "greeting is not defined",
      componentStack: "\n    at Ui",
    });
    expect(res.lastSeq).toBeGreaterThan(0);
  });

  it("polls only new errors with `since`, and says so when the ring is empty", async () => {
    const { tools, events } = boot();
    const first = events.reportAppError("com.example.err", { kind: "uncaught", message: "a" });
    events.reportAppError("com.example.err", { kind: "uncaught", message: "b" });

    const res = (await tools.invoke("mini_app_errors", { appId: "com.example.err", since: first })) as {
      errors: { message: string }[];
    };
    expect(res.errors.map((e) => e.message)).toEqual(["b"]);

    const empty = (await tools.invoke("mini_app_errors", { appId: "com.example.other" })) as {
      errors: unknown[];
      emptyHint?: string;
    };
    expect(empty.errors).toEqual([]);
    // An empty ring is not "no bugs" — it usually means nobody opened the app.
    expect(empty.emptyHint).toMatch(/mini_app_open/);
  });

  it("clear:true empties the ring", async () => {
    const { tools, events } = boot();
    events.reportAppError("com.example.err", { kind: "render", message: "a" });
    const res = (await tools.invoke("mini_app_errors", { appId: "com.example.err", clear: true })) as {
      errors: unknown[];
    };
    expect(res.errors).toEqual([]);
  });
});

describe("ToolFacade.mini_app_dom_snapshot", () => {
  it("reads the last reported outline with a self-describing key legend", async () => {
    const { tools, events } = boot();
    events.reportAppSnapshot("com.example.snap", {
      dom: { t: "div", c: "flex gap-3", w: 400, h: 80, k: [{ t: "button", x: "Save", s: { d: "inline-flex", c: "rgb(17,17,17)" } }] },
      viewport: { width: 900, height: 600 },
    });
    const res = (await tools.invoke("mini_app_dom_snapshot", { appId: "com.example.snap" })) as {
      ok: boolean;
      dom: { t: string; k?: unknown[] };
      keys: string;
      viewport?: { width: number };
      ageMs: number;
    };
    expect(res.ok).toBe(true);
    expect(res.dom.t).toBe("div");
    expect(res.keys).toContain("t=tag");
    expect(res.viewport?.width).toBe(900);
  });

  it("trims by depth instead of dumping the whole tree", async () => {
    const { tools, events } = boot();
    events.reportAppSnapshot("com.example.snap", {
      dom: { t: "div", k: [{ t: "div", k: [{ t: "div", k: [{ t: "span", x: "deep" }] }] }] },
    });
    const res = (await tools.invoke("mini_app_dom_snapshot", {
      appId: "com.example.snap",
      depth: 2,
    })) as { dom: { k?: { k?: unknown }[] } };
    expect(res.dom.k?.[0].k).toBeUndefined();
  });

  it("tells the agent to open the app rather than returning a bare null", async () => {
    const { tools } = boot();
    const res = (await tools.invoke("mini_app_dom_snapshot", { appId: "com.example.none" })) as {
      snapshot: null;
      hint?: string;
    };
    expect(res.snapshot).toBeNull();
    expect(res.hint).toMatch(/mini_app_open/);
  });
});

describe("ToolFacade.mini_app_call batch", () => {
  const crudApi = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "CRUD",
  description: "crud",
  api: {
    async list(ctx) { return await ctx.storage.get("items"); },
    async add(ctx, args) { await ctx.storage.set("items", [args]); return args; },
    async boom() { throw new Error("nope"); },
  },
});
`;

  async function bootCrud() {
    const b = boot();
    await b.tools.invoke("mini_app_register", {
      appId: "com.example.crud",
      files: {
        "manifest.json": JSON.stringify({
          id: "com.example.crud",
          name: "CRUD",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": crudApi,
        "ui.tsx": "export default function Ui(){return null}",
      },
    });
    return b;
  }

  it("runs a whole smoke test in one round trip", async () => {
    const { tools } = await bootCrud();
    const res = (await tools.invoke("mini_app_call", {
      appId: "com.example.crud",
      calls: [{ method: "add", args: { title: "t" } }, { method: "list" }],
    })) as { ok: boolean; failed: number; results: { method: string; ok: boolean; value?: unknown }[] };
    expect(res.ok).toBe(true);
    expect(res.failed).toBe(0);
    expect(res.results.map((r) => r.method)).toEqual(["add", "list"]);
    expect(res.results[0].value).toEqual({ title: "t" });
  });

  it("keeps going after one method throws, so one failure does not hide the rest", async () => {
    const { tools } = await bootCrud();
    const res = (await tools.invoke("mini_app_call", {
      appId: "com.example.crud",
      calls: [{ method: "add", args: { title: "t" } }, { method: "boom" }, { method: "list" }],
    })) as { ok: boolean; failed: number; results: { method: string; ok: boolean }[] };
    expect(res.ok).toBe(false);
    expect(res.failed).toBe(1);
    expect(res.results.map((r) => r.ok)).toEqual([true, false, true]);
  });

  it("still accepts the single-method shape", async () => {
    const { tools } = await bootCrud();
    const res = (await tools.invoke("mini_app_call", {
      appId: "com.example.crud",
      method: "add",
      args: { title: "one" },
    })) as { ok: boolean; value: unknown };
    expect(res).toEqual({ ok: true, value: { title: "one" } });
  });

  it("rejects an empty or absurd batch", async () => {
    const { tools } = await bootCrud();
    await expect(
      tools.invoke("mini_app_call", { appId: "com.example.crud", calls: [] }),
    ).rejects.toBeInstanceOf(HostError);
    await expect(
      tools.invoke("mini_app_call", {
        appId: "com.example.crud",
        calls: Array.from({ length: 21 }, () => ({ method: "list" })),
      }),
    ).rejects.toBeInstanceOf(HostError);
  });
});
