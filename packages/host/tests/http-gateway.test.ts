import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Host} from "@monkey-mini-app/host";
import {
  AppsManager,
  bootstrapHostConfig,
  createHost,
  type HostCapabilities,
  type HostConfig,
  type HostLifecycle,
  type HostServices,
  type ThemeResource,
  ToolFacade,
} from "@monkey-mini-app/host";

function validConfig(): HostConfig {
  const dir = mkdtempSync(path.join(tmpdir(), "mma-http-"));
  return bootstrapHostConfig({ runtimeRoot: dir, hostPort: 0 });
}

function fakeCapabilities(): HostCapabilities {
  return {
    bash: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    listTools: () => [],
  };
}

const pingApi = `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({
  name: "Ping",
  description: "ping",
  api: { ping: async (_ctx, args) => ({ pong: true, args }) },
});
`;

const simpleUi = `export default function Ui() {
  return <div>hello-mini-app</div>;
}
`;

const manifest = JSON.stringify({
  id: "com.example.todo",
  name: "Todo",
  version: "0.1.0",
  entry: "ui.tsx",
});

let host: Host | undefined;

afterEach(async () => {
  if (host) {
    await host.stop();
    host = undefined;
  }
  vi.restoreAllMocks();
});

function origin(): string {
  return `http://127.0.0.1:${host!.port}`;
}

async function startHost(themes?: ThemeResource): Promise<HostServices> {
  let services: HostServices | undefined;
  const lifecycle: HostLifecycle = {
    attach: (_ctx, s) => {
      services = s;
    },
  };
  host = createHost(fakeCapabilities(), lifecycle, { config: validConfig(), themes });
  await host.apply();
  if (!services) {
    throw new Error("lifecycle.attach did not receive HostServices");
  }
  return services;
}

describe("HttpGateway", () => {
  it("GET /api/apps returns 200 JSON from AppsManager.list", async () => {
    const invoke = vi.spyOn(ToolFacade.prototype, "invoke");
    const list = vi.spyOn(AppsManager.prototype, "list");
    await startHost();

    const res = await fetch(`${origin()}/api/apps`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body: unknown = await res.json();
    expect(body).toEqual({ apps: [] });
    expect(list).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("POST /api/call uses AppsManager.call and does not call tools.invoke", async () => {
    const invoke = vi.spyOn(ToolFacade.prototype, "invoke");
    const call = vi.spyOn(AppsManager.prototype, "call");
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });

    const listed = await fetch(`${origin()}/api/apps`);
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as { apps: Array<{ id: string }> };
    expect(listedBody.apps).toHaveLength(1);
    expect(listedBody.apps[0]?.id).toBe("com.example.todo");

    const res = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appId: "com.example.todo",
        method: "ping",
        args: { n: 1 },
      }),
    });
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toEqual({ ok: true, value: { pong: true, args: { n: 1 } } });
    expect(call).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("GET /api/host-config returns public config without secrets", async () => {
    await startHost();
    const res = await fetch(`${origin()}/api/host-config`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.theme).toBe("light");
    expect(body.palette).toBe("default");
    expect(body.locale).toBe("zh-CN");
    expect(body.chatLanguage).toBe("zh-CN");
    expect(body.llm).toBeNull();
    expect(body.hostPort).toBe(host!.port);
    expect(body).not.toHaveProperty("runtimeRoot");
    expect(JSON.stringify(body)).not.toMatch(/secret|apiKey|token/i);
  });

  it("POST /api/host-config persists theme and palette to host.json", async () => {
    const services = await startHost();
    const res = await fetch(`${origin()}/api/host-config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "dark", palette: "tokyo" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, theme: "dark", palette: "tokyo" });

    const get = await fetch(`${origin()}/api/host-config`);
    await expect(get.json()).resolves.toMatchObject({ theme: "dark", palette: "tokyo" });

    const raw = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(services.paths.hostConfigFile(), "utf8"),
      ),
    ) as Record<string, unknown>;
    expect(raw.theme).toBe("dark");
    expect(raw.palette).toBe("tokyo");
  });

  it("GET /health returns ok and the bound port", async () => {
    await startHost();
    const res = await fetch(`${origin()}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, hostPort: host!.port });
  });

  it("GET /api/events streams app:open from mini_app_open", async () => {
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });
    const controller = new AbortController();
    const res = await fetch(`${origin()}/api/events`, { signal: controller.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const reader = res.body!.getReader();
    const read = (async () => {
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (buf.includes("app:open") && buf.includes("com.example.todo")) return buf;
      }
      return buf;
    })();
    await services.tools.invoke("mini_app_open", { appId: "com.example.todo", title: "Todo" });
    const stream = await Promise.race([
      read,
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 4000)),
    ]);
    controller.abort();
    expect(stream).toContain("event: app:open");
    expect(stream).toContain("com.example.todo");
  }, 15_000);

  it("GET /app/:appId returns runner HTML that loads the compiled entry", async () => {
    await startHost();
    const res = await fetch(`${origin()}/app/com.example.todo`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/html/);
    const html = await res.text();
    expect(html).toContain('const APP_ID = "com.example.todo"');
    expect(html).toContain('import("/api/app/" + encodeURIComponent(APP_ID) + "/ui/entry.js")');
    expect(html).toContain("/ui.css");
  });

  it("GET /app/:appId injects ThemeResource.runnerCss", async () => {
    await startHost({
      runnerCss: () => 'html[data-theme="dark"][data-palette="tokyo"]{--primary:#7aa2f7}',
    });
    const res = await fetch(`${origin()}/app/com.example.todo`);
    const html = await res.text();
    expect(html).toContain('html[data-theme="dark"][data-palette="tokyo"]{--primary:#7aa2f7}');
  });

  it("GET /api/palettes returns ThemeResource custom palettes", async () => {
    await startHost({
      runnerCss: () => "",
      listCustomPalettes: () => [
        { id: "crimson", label: "Crimson", swatch: "#a00", custom: true },
      ],
    });
    const res = await fetch(`${origin()}/api/palettes`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      palettes: [{ id: "crimson", label: "Crimson", swatch: "#a00", custom: true }],
    });
  });

  it("GET /api/app/:appId/ui/entry.js compiles a smoke UI bundle", async () => {
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });
    const res = await fetch(`${origin()}/api/app/com.example.todo/ui/entry.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const js = await res.text();
    expect(js.length).toBeGreaterThan(100);
    expect(js).toContain("hello-mini-app");
  });

  it("GET /ui.css serves the ui dist stylesheet", async () => {
    await startHost();
    const res = await fetch(`${origin()}/ui.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/css/);
    const css = await res.text();
    expect(css.length).toBeGreaterThan(10);
  });

  it("GET /api/apps/:id/history and storage return browse payloads", async () => {
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });
    const dir = services.apps.dirOf("com.example.todo");
    await services.git.init(dir);
    await services.git.commit(dir, "init");
    const storageDir = path.join(dir, "storage");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(path.join(storageDir, "main.json"), JSON.stringify({ a: 1 }));

    const hist = await fetch(`${origin()}/api/apps/com.example.todo/history?limit=10`);
    expect(hist.status).toBe(200);
    const histBody = (await hist.json()) as { ok: boolean; commits: Array<{ id: string }> };
    expect(histBody.ok).toBe(true);
    expect(histBody.commits.length).toBeGreaterThan(0);

    const detail = await fetch(
      `${origin()}/api/apps/com.example.todo/history/${histBody.commits[0]!.id}`,
    );
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { ok: boolean; commit: { id: string } };
    expect(detailBody.ok).toBe(true);
    expect(detailBody.commit.id).toBe(histBody.commits[0]!.id);

    const tables = await fetch(`${origin()}/api/apps/com.example.todo/storage`);
    expect(tables.status).toBe(200);
    const tablesBody = (await tables.json()) as {
      ok: boolean;
      tables: Array<{ name: string }>;
    };
    expect(tablesBody.ok).toBe(true);
    expect(tablesBody.tables.some((t) => t.name === "main")).toBe(true);

    const table = await fetch(`${origin()}/api/apps/com.example.todo/storage/main`);
    expect(table.status).toBe(200);
    await expect(table.json()).resolves.toEqual({ ok: true, table: "main", value: { a: 1 } });
  });

  it("POST /api/call rejects invalid JSON and missing fields", async () => {
    await startHost();
    const bad = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ ok: false });

    const arr = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    });
    expect(arr.status).toBe(400);

    const missing = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: "com.example.todo" }),
    });
    expect(missing.status).toBe(400);
    const missingBody = (await missing.json()) as { error: string };
    expect(missingBody.error).toMatch(/appId or method/);
  });

  it("returns 404 for unknown routes and non-js UI bundle names", async () => {
    await startHost();
    const missing = await fetch(`${origin()}/nope`);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "not_found" });

    const notJs = await fetch(`${origin()}/api/app/com.example.todo/ui/readme.txt`);
    expect(notJs.status).toBe(404);
  });

  it("maps UI compile failures to 400", async () => {
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "main.api.ts": pingApi,
    });
    const res = await fetch(`${origin()}/api/app/com.example.todo/ui/entry.js`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing ui entry/i);
  });

  it("POST /api/call maps missing methods to { ok: false } without tools.invoke", async () => {
    const invoke = vi.spyOn(ToolFacade.prototype, "invoke");
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });
    const res = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: "com.example.todo", method: "nope" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not found/i);
    expect(invoke).not.toHaveBeenCalled();
  });
});
