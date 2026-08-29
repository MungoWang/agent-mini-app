/** createHost 集成测试：组合根 + HTTP 面（真实端口 + fixture app）。 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHost, type HostAdapter } from "./host.js";
import { createMiniAppTools } from "./tools.js";

let tmp: string;
let port: number;
let host: ReturnType<typeof createHost>;

function fixtureApp(id: string, name: string): void {
  const dir = path.join(tmp, "apps", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ id, name, version: "1.0.0", entry: "ui.tsx" })
  );
  fs.writeFileSync(
    path.join(dir, "main.api.ts"),
    `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({
  name: "${name}",
  description: "fixture",
  api: {
    ping: async (ctx, args) => ({ ok: true, args }),
  },
});`
  );
  fs.writeFileSync(
    path.join(dir, "ui.tsx"),
    `export default function Ui() { return <div>hi</div> }`
  );
}

const adapter: HostAdapter = {
  capabilities: () => ({
    bash: async () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
    llm: async (p) => "llm:" + p.slice(0, 8),
    agent: async (g) => "agent:" + g.slice(0, 8),
  }),
  listTools: () => [{ name: "fixture_tool", description: "t" }],
};

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mma-host-test-"));
  fs.mkdirSync(path.join(tmp, "apps"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "host.json"), JSON.stringify({ hostPort: 0, theme: "light", palette: "default", chatLanguage: "zh", llm: { provider: "test", model: "m1" } }));
  fixtureApp("com.example.test", "测试应用");
  host = createHost(adapter, { runtimeRoot: tmp, hostPort: 0 });
  const r = await host.start();
  port = r.port;
});

afterAll(async () => {
  await host.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const post = (p: string, body: unknown) =>
  fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

describe("createHost HTTP 面", () => {
  it("GET /health 返回 runtimeRoot + 端口", async () => {
    const r = await get("/health");
    expect(r.status).toBe(200);
    expect((r.json as { runtimeRoot: string }).runtimeRoot).toBe(tmp);
  });

  it("GET /api/apps 列出 fixture app（enrich 元数据）", async () => {
    const r = await get("/api/apps");
    expect(r.status).toBe(200);
    const apps = (r.json as { apps: any[] }).apps;
    expect(apps.some((a) => a.id === "com.example.test")).toBe(true);
    expect(apps.find((a) => a.id === "com.example.test").name).toBe("测试应用");
  });

  it("GET /app/:id 返回 runner HTML（含 APP_ID）", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/app/com.example.test`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('id="root" class="boot"');
    expect(html).toContain('APP_ID = "com.example.test"');
  });

  it("POST /api/call 走 dashboard 执行引擎（不借道 agent 协议）", async () => {
    const r = await post("/api/call", { appId: "com.example.test", method: "ping", args: { a: 1 } });
    expect(r.status).toBe(200);
    expect((r.json as { ok: boolean; value: any }).value).toEqual({ ok: true, args: { a: 1 } });
  });

  it("GET /api/palettes 返回内置 + 自定义", async () => {
    const r = await get("/api/palettes");
    expect(r.status).toBe(200);
    expect((r.json as { palettes: any[] }).palettes.length).toBeGreaterThanOrEqual(8);
  });

  it("GET /api/host-config 返回保存的配置", async () => {
    const r = await get("/api/host-config");
    expect(r.status).toBe(200);
    expect((r.json as { chatLanguage: string }).chatLanguage).toBe("zh");
  });

  it("GET /api/ctx-tools 走 adapter.listTools", async () => {
    const r = await get("/api/ctx-tools");
    expect(r.status).toBe(200);
    expect((r.json as { tools: any[] }).tools[0].name).toBe("fixture_tool");
  });

  it("POST /api/apps/:id/theme 保存并回读", async () => {
    const r = await post("/api/apps/com.example.test/theme", { theme: "dark", palette: "slate" });
    expect(r.status).toBe(200);
    const g = await get("/api/apps/com.example.test/theme");
    expect((g.json as { theme: any }).theme).toEqual({ theme: "dark", palette: "slate" });
  });

  it("未知路径 404", async () => {
    const r = await get("/nope");
    expect(r.status).toBe(404);
  });

  it("app ctx.storage 契约方法名（get/set/delete/clear/table）", async () => {
    const mod = await import("./apps.js");
    const mgr = new mod.AppsManager(tmp, {});
    const dash = mgr.dashboard(path.join(tmp, "apps", "com.example.test"));
    const storage = dash.ctx.storage as {
      get: (k: string) => Promise<unknown>;
      set: (k: string, v: unknown) => Promise<void>;
      delete: (k: string) => Promise<void>;
      clear: () => Promise<void>;
      table: (n: string) => unknown;
    };
    expect(typeof storage.get).toBe("function");
    expect(typeof storage.set).toBe("function");
    expect(typeof storage.delete).toBe("function");
    expect(typeof storage.clear).toBe("function");
    expect(typeof storage.table).toBe("function");
    await storage.set("a", 1);
    expect(await storage.get("a")).toBe(1);
    await storage.delete("a");
    expect(await storage.get("a")).toBeNull();
  });
});

describe("SSE app:open 事件（mini_app_open → 实时推送，取代轮询）", () => {
  it("模型调 mini_app_open → SSE 流收到 app:open", async () => {
    // adapter 在 attach 里捕获 services.tools，测试端触发工具执行
    let capturedTools: { invoke: (n: string, a: Record<string, unknown>) => Promise<unknown> } | null = null;
    const adapter2: HostAdapter = {
      capabilities: () => ({}),
      listTools: () => [],
      async attach(_c, services) {
        capturedTools = services.tools;
      },
    };
    const h = createHost(adapter2, { runtimeRoot: tmp, hostPort: 0 });
    await h.apply();   // apply 触发 adapter.attach（捕获 services.tools）+ 起 HTTP
    try {
      // 建立 SSE 客户端（读流）
      const controller = new AbortController();
      const resp = await fetch(`http://127.0.0.1:${h.port}/api/events`, { signal: controller.signal });
      expect(resp.status).toBe(200);
      const reader = resp.body!.getReader();
      const readPromise = (async () => {
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          if (buf.includes("app:open")) return buf;
        }
        return buf;
      })();
      // 触发 mini_app_open（模型工具执行路径）
      await capturedTools!.invoke("mini_app_open", { appId: "com.example.test", title: "SSE 测试" });
      const stream = await Promise.race([readPromise, new Promise<string>((r) => setTimeout(() => r("timeout"), 4000))]);
      controller.abort();
      expect(stream).toContain("event: app:open");
      expect(stream).toContain("com.example.test");
    } finally {
      await h.stop();
    }
  }, 15_000);
});

describe("createMiniAppTools", () => {
  it("生成 mini_app_* 工具并执行（mini_app_call 走 dashboard 引擎）", async () => {
    // createHost 不暴露 runtime——用 stub 验证工具生成
    const apps = await import("./apps.js").then((m) => m.AppsManager);
    const mgr = new apps(tmp, adapter.capabilities?.() || {});
    const fakeRuntime = {
      listApps: async () => [{ id: "com.example.test", name: "测试应用", version: "1.0.0" }],
      getApp: async (id: string) => ({ id, name: "测试应用" }),
      registerAppFromFiles: async () => ({}),
      openTab: async (id: string) => ({ id: "t1", appId: id }),
      closeTab: async () => {},
      listTabs: async () => [],
    };
    const tools = createMiniAppTools(fakeRuntime as never, mgr, tmp);
    expect(tools.tools.some((t) => t.name === "mini_app_call")).toBe(true);
    expect(tools.tools.some((t) => t.name === "mini_app_list")).toBe(true);
    // 每个工具定义自带 execute（adapter 注册时直接用，否则工具调用返回 no execute）
    for (const t of tools.tools) {
      expect(typeof t.execute).toBe("function");
    }
    const out = await tools.invoke("mini_app_call", { appId: "com.example.test", method: "ping", args: { b: 2 } });
    expect((out as { ok: boolean; value: any }).value).toEqual({ ok: true, args: { b: 2 } });
  });
});
