/** @monkey-mini-app/host-core — createHost 组合根（dotnet HostBuilder 风格）。
 *  createHost(adapter, options) → Host：组装内部服务（runtime/apps/themes/git/ui）+ HTTP 面。
 *  任何 agent（dsh / PI）实现 HostAdapter 即得完整 mini-app host。
 *  原则：能力（managers）与接口形式（HTTP / agent 工具）分离——HTTP 不借道 agent 工具。 */
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { createNodeHostPort } from "./node-fs.js";
import { createGitHistoryAdapter } from "./git.js";
import { createRuntime } from "./runtime/index.js";
import { AppsManager, type HostCapabilities } from "./apps.js";
import { createMiniAppTools, type MiniAppTools } from "./tools.js";
import { resolveUiDistDir, compileUiBundle, invalidateUiCache } from "./compile-ui.js";
import { loadCustomPalettes, listStorageTables, storageTablePath, readAppTheme, writeAppTheme, enrichAppMeta } from "./app-meta.js";
import { appRunnerHtml } from "./runner.js";
import { gitLog, gitFileStats, gitFilePreview } from "./git.js";
import {
  readHostConfig,
  writeHostConfig,
  publicAppConfig,
  clampPort,
  DEFAULT_HOST_CONFIG,
  type HostConfig,
} from "./host-config.js";
import { PALETTES, clampPalette } from "@monkey-mini-app/panel-core";

export async function listenOn(server: http.Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (e: Error) => {
      server.off("listening", onListening);
      reject(e);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

/** HostAdapter —— 插件实例接口（agent 能力接缝）。
 *  数据/调用面可选：默认由 createHost 内部的 AppsManager（runtime 之上）实现，
 *  agent 协议层（模型工具）如需独立实现可覆盖。 */
export interface HostAdapter {
  // 数据面（可选——默认 AppsManager.list：runtime 列表 + enrich）
  listApps?(): Promise<{ apps: any[]; runtimeRoot?: string }>;
  // 调用面（可选——默认 AppsManager.call：dashboard 执行引擎）
  callApp?(appId: string, method: string, args: unknown, signal?: AbortSignal): Promise<unknown>;
  // 宿主接入面（可选）
  listTools?(): unknown[];
  onHostPortChanged?(port: number): void;
  // app ctx 宿主能力（bash/llm/agent/tool/mcp/credentials/config）
  capabilities?(): HostCapabilities;
  // 生命周期钩子（agent 挂载/卸载——dsh：注册模型工具/注入 UI slots）
  attach?(ctx: unknown, services: HostServices): void | Promise<void>;
  detach?(): void | Promise<void>;
}

export type HostOptions = {
  runtimeRoot: string;
  hostPort: number;
  demoDir?: string;
  themeId?: string;
};

type RuntimeT = Awaited<ReturnType<typeof createRuntime>>;

/** createHost 暴露给 adapter.attach 的内部服务（能力 vs 接口形式分离）。 */
export type HostServices = {
  runtime: RuntimeT;
  apps: AppsManager;
  tools: MiniAppTools;
};

export interface Host {
  apply(ctx?: unknown): Promise<{ port: number }>;
  start(): Promise<{ port: number }>;
  stop(): Promise<void>;
  get port(): number;
}

export function createHost(adapter: HostAdapter, options: HostOptions): Host {
  const { runtimeRoot, hostPort, themeId } = options;
  const demoRoot = options.demoDir || process.env.MONKEY_MINI_APP_DEMO_DIR || "";
  const caps: HostCapabilities = adapter.capabilities ? adapter.capabilities() : {};
  const cfg = () => readHostConfig(runtimeRoot);

  // —— 内部服务组合（host 能力，agent 无关）——
  const nodeHost = createNodeHostPort({ runtimeRoot });
  const history = createGitHistoryAdapter();
  type RuntimeT = Awaited<ReturnType<typeof createRuntime>>;
  let runtimePromise: Promise<RuntimeT> | null = null;
  function runtime(): Promise<RuntimeT> {
    if (!runtimePromise) runtimePromise = createRuntime({ host: nodeHost, history, themeId });
    return runtimePromise;
  }
  const apps = new AppsManager(runtimeRoot, caps, { hostConfig: cfg });
  // —— 工具执行事件 → SSE 广播（agent 无关；client EventSource 订阅）——
  type HostEvent = { type: "app:open"; appId: string; title?: string };
  type SseClient = { res: http.ServerResponse; id: number };
  let sseId = 0;
  const sseClients = new Set<SseClient>();
  const emitEvent = (ev: HostEvent) => {
    const payload = `id: ${++sseId}\nevent: ${ev.type}\ndata: ${JSON.stringify({ appId: ev.appId, title: ev.title })}\n\n`;
    for (const c of sseClients) {
      try {
        c.res.write(payload);
      } catch {
        /* client gone */
      }
    }
  };
  const listApps = async () => {
    const rt = await runtime();
    const raw = await rt.listApps();
    const withMeta = await Promise.all(
      raw.map(async (a: any) => {
        const dir = apps.dirOf(a.id);
        return enrichAppMeta(a, dir);
      })
    );
    return { apps: withMeta, runtimeRoot };
  };

  let server: http.Server | null = null;
  let currentPort = 0;

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const send = (code: number, body: string | Buffer, type = "application/json; charset=utf-8") => {
      res.writeHead(code, { "Content-Type": type });
      res.end(body);
    };
    const appDirOf = (appId: string) => apps.dirOf(appId);
    const readJsonSafe = (p: string, fallback: unknown) => {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        return fallback;
      }
    };
    const readJsonBody = async (): Promise<Record<string, unknown>> => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    };

    try {
      if (url.pathname === "/ui.css") {
        try {
          send(200, fs.readFileSync(path.join(resolveUiDistDir(), "globals.css"), "utf8"), "text/css; charset=utf-8");
        } catch (e) {
          send(500, "ui.css missing: " + e, "text/plain");
        }
        return;
      }
      if (url.pathname === "/demo" || url.pathname.startsWith("/demo/")) {
        if (!demoRoot) {
          send(404, JSON.stringify({ error: "demo not configured" }));
          return;
        }
        const rel = url.pathname === "/demo" ? "index.html" : decodeURIComponent(url.pathname.slice("/demo/".length));
        const fp = path.join(demoRoot, rel);
        if (!fp.startsWith(demoRoot) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
          send(404, JSON.stringify({ error: "demo asset missing: " + rel }));
          return;
        }
        const ext = path.extname(fp);
        const type =
          ext === ".html" ? "text/html; charset=utf-8" :
          ext === ".css" ? "text/css; charset=utf-8" :
          ext === ".json" ? "application/json; charset=utf-8" :
          ext === ".svg" ? "image/svg+xml" :
          ext === ".woff2" ? "font/woff2" :
          "application/javascript; charset=utf-8";
        send(200, fs.readFileSync(fp), type);
        return;
      }
      const uiBuildMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/ui\/([^/]+)$/);
      if (uiBuildMatch) {
        const appId = decodeURIComponent(uiBuildMatch[1]);
        const name = decodeURIComponent(uiBuildMatch[2]);
        const files = await compileUiBundle(appDirOf(appId));
        const file = files.find((f) => f.name === name);
        if (!file) {
          send(404, JSON.stringify({ error: "bundle file missing: " + name }));
          return;
        }
        const body = Buffer.from(file.contents);
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Length": body.length,
          "Cache-Control": "no-cache",
        });
        res.end(body);
        return;
      }
      if (url.pathname.startsWith("/ui/")) {
        const rel = decodeURIComponent(url.pathname.slice(4));
        const base = resolveUiDistDir();
        const fp = path.join(base, rel);
        if (!fp.startsWith(base) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
          send(404, JSON.stringify({ error: "ui asset missing: " + rel }));
          return;
        }
        const ext = path.extname(fp);
        const type =
          ext === ".css" ? "text/css; charset=utf-8" :
          ext === ".json" ? "application/json; charset=utf-8" :
          ext === ".tsx" || ext === ".ts" ? "text/plain; charset=utf-8" :
          "application/javascript; charset=utf-8";
        send(200, fs.readFileSync(fp, "utf8"), type);
        return;
      }
      if (url.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const client: SseClient = { res, id: ++sseId };
        sseClients.add(client);
        res.write(`retry: 3000\n\n`);
        req.on("close", () => sseClients.delete(client));
        return;
      }
      if (url.pathname === "/health") {
        send(200, JSON.stringify({ ok: true, runtimeRoot, hostPort: currentPort }));
        return;
      }
      if (url.pathname === "/api/host-config" && req.method === "GET") {
        send(200, JSON.stringify({ ok: true, ...publicAppConfig(cfg(), currentPort) }));
        return;
      }
      if (url.pathname === "/api/host-config" && req.method === "POST") {
        const body = await readJsonBody();
        const cur = cfg();
        const next: HostConfig = {
          hostPort: body.hostPort != null ? clampPort(Number(body.hostPort)) : cur.hostPort,
          theme: body.theme === "dark" ? "dark" : body.theme === "light" ? "light" : cur.theme,
          palette: body.palette != null ? clampPalette(String(body.palette)) : cur.palette,
          chatLanguage: body.chatLanguage === "en" ? "en" : body.chatLanguage === "zh" ? "zh" : cur.chatLanguage,
          llm: {
            provider: String((body.llm as { provider?: unknown } | undefined)?.provider || cur.llm.provider),
            model: String((body.llm as { model?: unknown } | undefined)?.model || cur.llm.model),
          },
        };
        const portChanged = next.hostPort !== currentPort;
        if (portChanged) {
          const probe = http.createServer();
          try {
            await listenOn(probe, next.hostPort);
            await new Promise<void>((resolve, reject) => probe.close((err) => (err ? reject(err) : resolve())));
          } catch (e) {
            send(409, JSON.stringify({ ok: false, error: "port in use or bind failed: " + String((e as Error).message || e), hostPort: currentPort, ...publicAppConfig(cur, currentPort) }));
            return;
          }
        }
        const savedCfg = writeHostConfig(runtimeRoot, next);
        send(200, JSON.stringify({ ok: true, ...publicAppConfig(savedCfg, portChanged ? next.hostPort : currentPort) }));
        if (portChanged) {
          const target = next.hostPort;
          setImmediate(() => {
            listenOn(server!, target)
              .then(() => {
                currentPort = target;
                adapter.onHostPortChanged?.(target);
              })
              .catch((e) => console.warn("[monkey-mini-app] rebound failed", e));
          });
        }
        return;
      }
      if (url.pathname === "/api/llm-config" && req.method === "GET") {
        const c = cfg();
        send(200, JSON.stringify({ ok: true, ...c.llm, defaults: DEFAULT_HOST_CONFIG.llm }));
        return;
      }
      if (url.pathname === "/api/llm-config" && req.method === "POST") {
        const body = await readJsonBody();
        const cur = cfg();
        const savedCfg = writeHostConfig(runtimeRoot, {
          ...cur,
          llm: { provider: String(body.provider || cur.llm.provider), model: String(body.model || cur.llm.model) },
        });
        send(200, JSON.stringify({ ok: true, ...savedCfg.llm }));
        return;
      }
      if (url.pathname === "/api/ctx-tools" || url.pathname === "/api/monkey-mini-app/ctx-tools") {
        const listed = adapter.listTools ? adapter.listTools() : [];
        send(200, JSON.stringify({ ok: true, count: listed.length, tools: listed }));
        return;
      }
      if (url.pathname === "/api/palettes") {
        const builtin: Array<{ id: string; label: string; swatch: string; custom: boolean; tokens?: unknown }> =
          PALETTES.map((p) => ({ id: p.id, label: p.label, swatch: p.swatch, custom: false }));
        const custom = loadCustomPalettes(runtimeRoot).map((c) => ({
          id: c.id,
          label: c.label,
          swatch: c.swatch,
          custom: true,
          tokens: c.tokens,
        }));
        send(200, JSON.stringify({ ok: true, palettes: builtin.concat(custom) }));
        return;
      }
      if (url.pathname === "/api/apps" || url.pathname === "/api/monkey-mini-app/apps") {
        send(200, JSON.stringify(adapter.listApps ? await adapter.listApps() : await listApps()));
        return;
      }
      const histMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/history(?:\/([a-f0-9]{7,}))?$/);
      if (histMatch) {
        const appId = decodeURIComponent(histMatch[1]);
        const commitId = histMatch[2];
        const dir = appDirOf(appId);
        if (commitId) {
          const stats = await gitFileStats(dir, commitId);
          const log = await gitLog(dir, 200);
          const meta = log.find((c) => c.id === commitId);
          const files = await Promise.all(stats.map(async (s) => ({ ...s, preview: await gitFilePreview(dir, commitId, s.path) })));
          send(200, JSON.stringify({ ok: true, commit: { id: commitId, time: meta?.time || "", message: meta?.message || "", files } }));
        } else {
          const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
          const list = await gitLog(dir, limit);
          const withStats = await Promise.all(list.map(async (c) => ({ ...c, files: await gitFileStats(dir, c.id) })));
          send(200, JSON.stringify({ ok: true, commits: withStats }));
        }
        return;
      }
      const stoMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/storage(?:\/([^/]+))?$/);
      if (stoMatch) {
        const appId = decodeURIComponent(stoMatch[1]);
        const table = stoMatch[2];
        const dir = path.join(appDirOf(appId), "storage");
        if (table) {
          const fp = storageTablePath(dir, table);
          send(200, JSON.stringify({ ok: true, table, value: readJsonSafe(fp, null) }));
        } else {
          send(200, JSON.stringify({ ok: true, tables: listStorageTables(dir) }));
        }
        return;
      }
      const themeMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/theme$/);
      if (themeMatch) {
        const appId = decodeURIComponent(themeMatch[1]);
        const dir = appDirOf(appId);
        if (req.method === "GET") {
          send(200, JSON.stringify({ ok: true, appId, theme: readAppTheme(dir) }));
          return;
        }
        if (req.method === "POST") {
          const body = await readJsonBody();
          const saved = body.reset
            ? writeAppTheme(dir, null)
            : writeAppTheme(dir, { theme: String(body.theme || "light"), palette: String(body.palette || "default") });
          send(200, JSON.stringify({ ok: true, appId, theme: saved }));
          return;
        }
      }
      const srcMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/source$/);
      if (srcMatch) {
        const appId = decodeURIComponent(srcMatch[1]);
        const man = readJsonSafe(path.join(appDirOf(appId), "manifest.json"), {}) as { entry?: string };
        const entry = man.entry || "App.tsx";
        const fp = path.join(appDirOf(appId), entry);
        if (!fs.existsSync(fp)) {
          send(404, JSON.stringify({ error: "NO_ENTRY", path: fp }));
          return;
        }
        send(200, JSON.stringify({ appId, entry, source: fs.readFileSync(fp, "utf8") }));
        return;
      }
      if (url.pathname === "/api/invoke" && req.method === "POST") {
        const body = (await readJsonBody()) as { appId?: string; method?: string; args?: { key?: string; value?: unknown } };
        const appId = body.appId || "";
        const method = body.method || "";
        const file = path.join(appDirOf(appId), "storage", "default.json");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const store = (readJsonSafe(file, {}) as Record<string, unknown>) || {};
        if (method === "storage.get") {
          send(200, JSON.stringify({ ok: true, value: store[body.args?.key ?? ""] }));
          return;
        }
        if (method === "storage.set") {
          store[String(body.args?.key ?? "")] = body.args?.value;
          fs.writeFileSync(file, JSON.stringify(store, null, 2));
          send(200, JSON.stringify({ ok: true }));
          return;
        }
        if (method === "storage.getFile") {
          const name = String(body.args?.key || "default.json");
          send(200, JSON.stringify({ ok: true, value: readJsonSafe(path.join(appDirOf(appId), "storage", path.basename(name)), {}) }));
          return;
        }
        if (method === "storage.setFile") {
          const name = String(body.args?.key || "default.json");
          const fp2 = path.join(appDirOf(appId), "storage", path.basename(name));
          fs.mkdirSync(path.dirname(fp2), { recursive: true });
          fs.writeFileSync(fp2, JSON.stringify(body.args?.value ?? {}, null, 2));
          send(200, JSON.stringify({ ok: true }));
          return;
        }
        if (method === "time.now") {
          send(200, JSON.stringify({ ok: true, value: Date.now() }));
          return;
        }
        send(400, JSON.stringify({ ok: false, error: "UNKNOWN_METHOD" }));
        return;
      }
      if (url.pathname === "/api/call" && req.method === "POST") {
        const body = (await readJsonBody()) as { appId?: string; method?: string; args?: unknown };
        try {
          const value = adapter.callApp
            ? await adapter.callApp(String(body.appId || ""), String(body.method || ""), body.args)
            : await apps.call(appDirOf(String(body.appId || "")), String(body.method || ""), body.args);
          send(200, JSON.stringify({ ok: true, value }));
        } catch (e) {
          send(400, JSON.stringify({ ok: false, error: String((e as Error).message || e) }));
        }
        return;
      }
      const filesMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/files$/);
      if (filesMatch) {
        const appId = decodeURIComponent(filesMatch[1]);
        const root = appDirOf(appId);
        const files: Record<string, string> = {};
        const walk = (dir: string, prefix: string) => {
          if (!fs.existsSync(dir)) return;
          for (const name of fs.readdirSync(dir)) {
            if (name === "storage" || name === ".git" || name === "node_modules") continue;
            const full = path.join(dir, name);
            const rel = prefix ? prefix + "/" + name : name;
            if (fs.statSync(full).isDirectory()) walk(full, rel);
            else if (/\.(tsx?|jsx?|json|css)$/.test(name) && !/^main\.api\.(ts|js)$/.test(name))
              files[rel] = fs.readFileSync(full, "utf8");
          }
        };
        walk(root, "");
        send(200, JSON.stringify({ appId, files }));
        return;
      }
      const delMatch = url.pathname.match(/^\/api\/app\/([^/]+)$/);
      if (delMatch && req.method === "DELETE") {
        const appId = decodeURIComponent(delMatch[1]);
        const dir = appDirOf(appId);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        invalidateUiCache(dir);
        apps.invalidate(dir);
        send(200, JSON.stringify({ ok: true, appId }));
        return;
      }
      const appMatch = url.pathname.match(/^\/app\/([^/]+)$/);
      if (appMatch) {
        const appId = decodeURIComponent(appMatch[1]);
        send(200, appRunnerHtml(appId, runtimeRoot), "text/html; charset=utf-8");
        return;
      }
      send(404, JSON.stringify({ error: "not_found" }));
    } catch (e) {
      send(500, JSON.stringify({ error: String(e) }));
    }
  }

  return {
    get port() {
      return currentPort;
    },
    async start() {
      server = http.createServer((req, res) => {
        void handle(req, res);
      });
      await listenOn(server, hostPort).catch((e) => {
        console.warn("[monkey-mini-app] embedded host listen failed", e);
      });
      const addr = server.address();
      currentPort = typeof addr === "object" && addr ? addr.port : hostPort;
      return { port: currentPort };
    },
    async apply(ctx) {
      const rt = await runtime();
      const tools = createMiniAppTools(rt, apps, runtimeRoot);
      // mini_app_open 成功 → app:open 事件（SSE 推给浏览器 client——取代 pendingOpen 轮询）
      tools.on("after", "mini_app_open", ({ args }) => {
        emitEvent({ type: "app:open", appId: String(args.appId || ""), title: args.title as string | undefined });
      });
      if (adapter.attach) await adapter.attach(ctx, { runtime: rt, apps, tools });
      return this.start();
    },
    async stop() {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = null;
      }
      if (adapter.detach) await adapter.detach();
    },
  };
}
