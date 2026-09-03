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

const pingApi = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
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


/** Read an SSE body until `stop(buf)` matches (or the stream ends). */
async function readSse(
  res: Response,
  stop: (buf: string) => boolean,
  ms = 4000,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const done = (async () => {
    while (true) {
      const { value, done: fin } = await reader.read();
      if (fin) break;
      buf += decoder.decode(value, { stream: true });
      if (stop(buf)) break;
    }
    return buf;
  })();
  return Promise.race([done, new Promise<string>((r) => setTimeout(() => r(buf), ms))]);
}

function openStream(url: string, lastEventId?: string) {
  const controller = new AbortController();
  const headers = lastEventId ? { "Last-Event-ID": lastEventId } : undefined;
  const res = fetch(url, { signal: controller.signal, headers });
  return { controller, res };
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

  it("GET /api/app/:id/events streams that app's ctx.push events", async () => {
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pingApi,
    });
    const { controller, res } = openStream(`${origin()}/api/app/com.example.todo/events`);
    expect((await res).status).toBe(200);

    services.events.pushApp("com.example.todo", "progress", { pct: 40 });
    const stream = await readSse(
      (await res),
      (b) => b.includes("event: app:event") && b.includes('"pct":40'),
    );
    expect(stream).toContain('data: {"name":"progress","data":{"pct":40},"seq":1}');
    controller.abort();
  });

  it("GET /api/app/:id/events never leaks another app's events", async () => {
    const services = await startHost();
    const { controller, res } = openStream(`${origin()}/api/app/com.a/events`);
    const opened = await res;

    services.events.pushApp("com.b", "secret", { value: "nope" });
    services.events.pushApp("com.a", "visible", { value: "yes" });
    const stream = await readSse(opened, (b) => b.includes('"visible"'));

    expect(stream).toContain('"visible"');
    expect(stream).not.toContain("secret");
    expect(stream).not.toContain("com.b");
    controller.abort();
  });

  it("GET /api/app/:id/events replays after Last-Event-ID and flags a gap", async () => {
    const services = await startHost();
    for (let i = 1; i <= 3; i++) services.events.pushApp("com.a", "tick", i);

    const again = openStream(`${origin()}/api/app/com.a/events`, "1");
    const stream = await readSse(await again.res, (b) => b.includes('"seq":3'));
    expect(stream).toContain('"name":"tick","data":2');
    expect(stream).toContain('"name":"tick","data":3');
    expect(stream).not.toContain('"data":1,');
    again.controller.abort();

    // a cursor older than the ring buffer: replay what survives + an app:gap frame
    // 207 pushes > APP_EVENT_BUFFER: seq 1..7 have been evicted, 8..207 survive
    for (let i = 4; i <= 210; i++) services.events.pushApp("com.b", "tick", i);
    const stale = openStream(`${origin()}/api/app/com.b/events`, "1");
    // read past the gap frame to prove the surviving tail is still replayed
    const gapped = await readSse(await stale.res, (b) => b.includes('"seq":207'));
    expect(gapped).toContain("event: app:gap");
    expect(gapped).toContain('"seq":207');
    // evicted frames are not offered as if they were still there
    expect(gapped).not.toContain('"seq":7,"data"');
    expect(gapped).toContain('"seq":8');
    stale.controller.abort();
  });

  it("ctx.push inside an api call reaches the app's stream end to end", async () => {
    const pushApi = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Pusher",
  description: "pushes",
  api: {
    go: async (ctx) => {
      ctx.push("tick", { at: "inside-call" });
      return "ok";
    },
  },
});
`;
    const services = await startHost();
    await services.apps.register("com.example.todo", {
      "manifest.json": manifest,
      "ui.tsx": simpleUi,
      "main.api.ts": pushApi,
    });
    const { controller, res } = openStream(`${origin()}/api/app/com.example.todo/events`);
    const opened = await res;

    const call = await fetch(`${origin()}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: "com.example.todo", method: "go", args: {} }),
    });
    await expect(call.json()).resolves.toMatchObject({ ok: true, value: "ok" });

    const stream = await readSse(opened, (b) => b.includes("inside-call"));
    expect(stream).toContain('"name":"tick"');
    controller.abort();
  });

  it("POST /api/host-config keeps theme=system as a preference (not the resolved mode)", async () => {
    const services = await startHost();
    const res = await fetch(`${origin()}/api/host-config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "system" }),
    });
    await expect(res.json()).resolves.toMatchObject({ ok: true, theme: "system" });

    // what actually landed in host.json must still be "system"
    const raw = JSON.parse(
      await import("node:fs/promises").then((fs) => fs.readFile(services.paths.hostConfigFile(), "utf8")),
    ) as { theme: string };
    expect(raw.theme).toBe("system");
    // and it must survive a re-parse (THEME_PREF_IDS, not THEME_IDS)
    const get = await fetch(`${origin()}/api/host-config`);
    await expect(get.json()).resolves.toMatchObject({ theme: "system" });
  });

  it("GET /api/about reports adapter + platform package versions", async () => {
    let services: HostServices | undefined;
    host = createHost(fakeCapabilities(), { attach: (_c, s) => { services = s; } }, {
      config: validConfig(),
      about: { adapter: "testhost", packageName: "@monkey-mini-app/host", env: "test" },
    });
    await host.apply();
    expect(services).toBeDefined();

    const res = await fetch(`${origin()}/api/about`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      adapter: string;
      env: string;
      packages: { name: string; version: string }[];
    };
    expect(body).toMatchObject({ ok: true, adapter: "testhost", env: "test" });
    expect(body.packages.some((pkg) => pkg.name === "@monkey-mini-app/host")).toBe(true);
    expect(body.packages.every((pkg) => typeof pkg.version === "string")).toBe(true);
  });

  it("GET /api/updates answers without hitting the network when the registry is unreachable", async () => {
    let services: HostServices | undefined;
    host = createHost(fakeCapabilities(), { attach: (_c, s) => { services = s; } }, {
      config: validConfig(),
      about: { adapter: "testhost", packageName: "@monkey-mini-app/host", env: "test" },
    });
    await host.apply();
    expect(services).toBeDefined();

    const real = globalThis.fetch;
    // only the npm registry hop is offline; the gateway call itself must still work
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
      String(input).includes("registry.npmjs.org")
        ? Promise.reject(new Error("offline"))
        : real(input as RequestInfo, init),
    );
    const res = await real(`${origin()}/api/updates`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.name).toBe("@monkey-mini-app/host");
    expect(body.updateAvailable).toBe(false);
    spy.mockRestore();
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
    expect(html).toContain("/mma/runtime.js");
    expect(html).toContain("/mma/sdk.js");
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
    expect(js.length).toBeGreaterThan(20);
    expect(js).toContain("hello-mini-app");
    expect(js).toContain("/mma/runtime.js");
    expect(js).toContain("/mma/sdk.js");
  });

  it("GET /mma/runtime.js and /mma/sdk.js serve the platform files", async () => {
    await startHost();
    const runtime = await fetch(`${origin()}/mma/runtime.js`);
    expect(runtime.status).toBe(200);
    const runtimeJs = await runtime.text();
    expect(runtimeJs).toContain("useState");
    expect(runtimeJs).toContain("createRoot");
    const sdk = await fetch(`${origin()}/mma/sdk.js`);
    expect(sdk.status).toBe(200);
    const sdkJs = await sdk.text();
    expect(sdkJs).toContain("useApp");
    expect(sdkJs).toContain("/mma/runtime.js");
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

  it("rebounds HTTP when hostPort changes", async () => {
    await startHost();
    const oldPort = host!.port;
    const { createServer } = await import("node:net");
    const free = await new Promise<number>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const addr = probe.address();
        const p = typeof addr === "object" && addr ? addr.port : 0;
        probe.close((err) => (err ? reject(err) : resolve(p)));
      });
    });
    const res = await fetch(`http://127.0.0.1:${oldPort}/api/host-config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostPort: free }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; hostPort: number };
    expect(body.hostPort).toBe(free);
    let up = false;
    for (let i = 0; i < 25; i++) {
      try {
        const health = await fetch(`http://127.0.0.1:${free}/health`);
        if (health.ok) {
          up = true;
          break;
        }
      } catch {
        /* rebind in flight */
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(up).toBe(true);
    expect(host!.port).toBe(free);
  }, 15_000);
});
