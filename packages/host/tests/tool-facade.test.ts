import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  AppCssCompiler,
  AppsManager,
  bootstrapHostConfig,
  GitHistory,
  type HostConfig,
  HostError,
  type HostEvent,
  HostEventBus,
  type ReloadResult,
  ToolFacade,
  UiCompiler,
  VIEW_EVAL_BYTE_CAP,
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

  it("mini_app_reload defaults cleanCaches to true (app CSS memo always drops either way)", async () => {
    // Canary: agents used to pass nothing and inherit a stale .autogen/ui.css. The tool now
    // purges disk by default; AppsManager.reload({ }) without opts still keeps disk — that
    // split is intentional and this test pins the tool side.
    const { tools, apps, paths } = boot();
    apps.setCssCompiler(new AppCssCompiler(paths));
    const appId = "com.example.cachedefault";
    await tools.invoke("mini_app_register", {
      appId,
      files: {
        "manifest.json": JSON.stringify({
          id: appId,
          name: "Cache",
          version: "1.0.0",
          entry: "ui.tsx",
        }),
        "main.api.ts": pingApi,
        "ui.tsx": `export default function App() { return <div className="p-4">x</div>; }\n`,
      },
    });
    const dir = apps.dirOf(appId);
    const autogen = path.join(dir, ".autogen");
    mkdirSync(autogen, { recursive: true });
    const css = path.join(autogen, "ui.css");
    writeFileSync(css, ".stale{}", "utf8");

    const def = tools.definitions().find((t) => t.name === "mini_app_reload");
    const cleanProp = (def?.inputSchema as { properties?: { cleanCaches?: { description?: string } } })
      ?.properties?.cleanCaches;
    expect(cleanProp?.description ?? "").toMatch(/Default true/i);

    const purged = (await tools.invoke("mini_app_reload", { appId })) as ReloadResult;
    expect(purged.ok).toBe(true);
    expect(purged.caches).toMatchObject({ uiBundle: "dropped", appCss: "dropped", autogen: "removed" });
    expect(existsSync(css)).toBe(false);

    mkdirSync(autogen, { recursive: true });
    writeFileSync(css, ".stale-again{}", "utf8");
    const kept = (await tools.invoke("mini_app_reload", {
      appId,
      cleanCaches: false,
    })) as ReloadResult;
    expect(kept.ok).toBe(true);
    expect(kept.caches).toMatchObject({ uiBundle: "dropped", appCss: "dropped" });
    expect(kept.caches?.autogen).toBeUndefined();
    expect(existsSync(css)).toBe(true);
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

/** Reach into the bus for the in-flight requestId, the way a browser would have learned it. */
function eventsRequestId(events: HostEventBus): string {
  const box = events as unknown as { viewPending: Map<string, { appId: string }> };
  for (const [id, pending] of box.viewPending) if (pending.appId) return id;
  return "";
}

describe("ToolFacade.mini_app_view_eval", () => {
  it("asks the view and returns the answer with its guard counters", async () => {
    const { tools, events } = boot();
    let requestId = "";
    events.subscribe((e) => {
      if (e.type === "app:eval") requestId = e.requestId;
    });

    const pending = tools.invoke("mini_app_view_eval", {
      appId: "com.example.view",
      code: 'return mma.$("#root");',
    }) as Promise<Record<string, unknown>>;
    await vi.waitFor(() => expect(requestId).not.toBe(""));
    events.reportViewEval("com.example.view", {
      requestId,
      ok: true,
      result: "# 2 lines\ndiv#root\n  b \"hi\"",
      bytes: 40,
      truncated: true,
      stoppedBy: "bytes",
      visited: 2,
      matched: 1,
      dropped: 9,
    });

    await expect(pending).resolves.toMatchObject({
      ok: true,
      view: "live",
      truncated: true,
      stoppedBy: "bytes",
      visited: 2,
      matched: 1,
      dropped: 9,
    });
  });

  it("caps maxBytes at the hard ceiling before asking the view", async () => {
    const { tools, events } = boot();
    const asked: number[] = [];
    events.subscribe((e) => {
      if (e.type === "app:eval") asked.push(e.maxBytes);
    });
    const pending = tools.invoke("mini_app_view_eval", { appId: "com.example.view", maxBytes: 999_999 });
    await vi.waitFor(() => expect(asked.length).toBe(1));
    expect(asked[0]).toBe(VIEW_EVAL_BYTE_CAP);
    const id = eventsRequestId(events);
    events.reportViewEval("com.example.view", { requestId: id, ok: true, result: "x" });
    await expect(pending).resolves.toMatchObject({ ok: true, result: "x" });
  });

  it("names the four ways a view can be unreachable, each with a next step", async () => {
    const { tools, events } = boot();

    // 1. no browser attached at all
    const closed = (await tools.invoke("mini_app_view_eval", { appId: "com.example.view" })) as {
      ok: boolean;
      view: string;
      hint: string;
    };
    expect(closed).toMatchObject({ ok: false, view: "not-open" });
    expect(closed.hint).toMatch(/mini_app_open/);

    // 2/3. a browser is attached, but the view cannot answer
    events.subscribe(() => {});
    const noRunner = (await tools.invoke("mini_app_view_eval", {
      appId: "com.example.view",
      code: "return 1",
      maxBytes: 10,
    })) as { view: string; hint: string };
    expect(noRunner.view).toBe("runner-not-booted");
    expect(noRunner.hint).toMatch(/mini_app_errors/);

    events.reportViewAlive("com.example.view");
    const stuck = (await tools.invoke("mini_app_view_eval", { appId: "com.example.view" })) as {
      view: string;
      hint: string;
    };
    expect(stuck.view).toBe("stuck");
    expect(stuck.hint).toMatch(/reload the browser tab/);

    // 4. the view answered, and the agent's own JS was the thing that failed
    let requestId = "";
    events.subscribe((e) => {
      if (e.type === "app:eval") requestId = e.requestId;
    });
    const bad = tools.invoke("mini_app_view_eval", { appId: "com.example.view" }) as Promise<{
      ok: boolean;
      view: string;
      error: Record<string, unknown>;
    }>;
    await vi.waitFor(() => expect(requestId).not.toBe(""));
    events.reportViewEval("com.example.view", {
      requestId,
      ok: false,
      error: { kind: "syntax", message: "Unexpected token", line: 1 },
    });
    const res = await bad;
    // The view is alive here — telling the agent to reopen it would send them to wrong file.
    expect(res).toMatchObject({ ok: false, view: "live" });
    expect(res.error.kind).toBe("syntax");
  });

  it("reports an unavailable view instead of throwing when the host has no bus", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mma-tools-nobus-"));
    const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
    const paths = new WorkspacePaths(config.runtimeRoot);
    const git = new GitHistory();
    const apps = new AppsManager(paths, {}, git, config);
    const tools = new ToolFacade(apps, git, paths);
    const res = (await tools.invoke("mini_app_view_eval", { appId: "com.example.view" })) as {
      ok: boolean;
      view: string;
    };
    expect(res).toMatchObject({ ok: false, view: "not-open" });
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
