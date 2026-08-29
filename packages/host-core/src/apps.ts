/** @monkey-mini-app/host-core — AppsManager：应用加载/管理/dashboard 执行引擎（agent 无关）。 */
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { compileAppSource } from "./compile-app-source.js";
import { httpRequest, type HttpRequest } from "./ctx-http.js";
import { readHostConfig, publicAppConfig, type HostConfig } from "./host-config.js";

/** app 宿主能力（由 adapter 提供——dsh: createHostBridge；PI: 对应实现）。 */
export type HostCapabilities = {
  bash?(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  llm?(prompt: string, opts?: Record<string, unknown>): Promise<string>;
  agent?(goal: string, opts?: Record<string, unknown>): Promise<string>;
  tool?(name: string, args?: Record<string, unknown>): Promise<unknown>;
  mcp?(name: string, args?: Record<string, unknown>): Promise<unknown>;
  credentials?(): Record<string, string>;
  config?(): Record<string, unknown>;
  listTools?(): unknown[];
};

export type AppContext = {
  storage: unknown;
  state: unknown;
  credentials: Record<string, string>;
  log(...a: unknown[]): void;
  push(method: string, params?: unknown): void;
  mcp(name: string, args?: Record<string, unknown>): Promise<unknown>;
  tool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  listTools(): unknown[];
  llm(prompt: string, opts?: Record<string, unknown>): Promise<string>;
  agent(goal: string, opts?: Record<string, unknown>): Promise<string>;
  bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  http(url: string | HttpRequest, opts?: Omit<HttpRequest, "url">): Promise<unknown>;
  system: { metrics(): Promise<Record<string, unknown>> };
  config: Record<string, unknown>;
};

export type DashboardDef = {
  name: string;
  description: string;
  api: Record<string, (ctx: AppContext, args: unknown) => Promise<unknown>>;
  state?: Record<string, unknown>;
};

function defineDashboard(def: DashboardDef): DashboardDef {
  if (!def?.name || !def?.description) throw new Error("defineDashboard requires name and description");
  if (!def.api || typeof def.api !== "object") throw new Error("defineDashboard.api must be an object");
  return def;
}

function makeFileStorage(appDir: string, fileName: string) {
  const fp = path.join(appDir, "storage", fileName);
  const read = (): Record<string, unknown> => {
    try {
      return JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch {
      return {};
    }
  };
  const write = (obj: Record<string, unknown>) => {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(obj, null, 2));
  };
  return {
    async get(key: string) {
      const obj = read();
      return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
    },
    async set(key: string, value: unknown) {
      const obj = read();
      obj[key] = value as unknown;
      write(obj);
    },
    // 契约方法名是 delete（对象方法可用保留字名）——勿改成 del/remove
    async delete(key: string) {
      const obj = read();
      delete obj[key];
      write(obj);
    },
    async clear() {
      write({});
    },
    table(name: string) {
      const safe = String(name).replace(/[^A-Za-z0-9_-]/g, "_");
      return makeFileStorage(appDir, `${safe}.storage.json`);
    },
  };
}

function resolveAppModule(fromFile: string, spec: string, appDir: string): string {
  const root = path.resolve(appDir);
  const base = spec.startsWith(".")
    ? path.resolve(path.dirname(fromFile), spec)
    : path.resolve(root, spec);
  const resolved = path.resolve(base);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`backend import escapes app dir: ${spec}`);
  }
  const candidates = [
    resolved,
    resolved + ".ts",
    resolved + ".js",
    resolved + ".tsx",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`cannot resolve '${spec}' from ${path.relative(appDir, fromFile)}`);
}

const loadedAppModules = new Map<string, any>();

function loadAppFile(file: string, appDir: string): any {
  const key = file;
  if (loadedAppModules.has(key)) return loadedAppModules.get(key);
  const mod: { exports: any } = { exports: {} };
  loadedAppModules.set(key, mod.exports);
  const raw = fs.readFileSync(file, "utf8");
  const src = compileAppSource(raw);
  const req = (spec: string) => {
    if (spec === "@monkeyagent/dashboard") {
      return { defineDashboard, default: defineDashboard };
    }
    if (spec.startsWith(".") || spec.startsWith("lib/") || spec.startsWith("components/")) {
      const next = resolveAppModule(file, spec, appDir);
      return loadAppFile(next, appDir);
    }
    throw new Error(
      `backend cannot import '${spec}'. Only @monkeyagent/dashboard and relative ./lib ./components`
    );
  };
  const fn = new Function("module", "exports", "require", src + "\nreturn module.exports;");
  const exported = fn(mod, mod.exports, req);
  const value = exported || mod.exports;
  loadedAppModules.set(key, value);
  return value;
}

function loadMainApi(appDir: string): any {
  loadedAppModules.clear();
  const fp = path.join(appDir, "main.api.ts");
  const fpJs = path.join(appDir, "main.api.js");
  const srcPath = fs.existsSync(fp) ? fp : fpJs;
  if (!fs.existsSync(srcPath)) throw new Error("missing main.api.ts");
  const exported = loadAppFile(srcPath, appDir);
  return (exported && (exported.default || exported)) || exported;
}

/** AppsManager —— 应用加载/管理/dashboard 执行（host-core 默认实现）。 */
export class AppsManager {
  private dashboardCache = new Map<string, { mtime: number; def: any; ctx: any }>();
  private hostConfig: () => HostConfig;

  constructor(
    private runtimeRoot: string,
    private caps: HostCapabilities,
    opts?: { hostConfig?: () => HostConfig }
  ) {
    this.hostConfig = opts?.hostConfig || (() => readHostConfig(runtimeRoot));
  }

  dirOf(appId: string): string {
    return path.join(this.runtimeRoot, "apps", appId);
  }

  /** 加载 app 的 dashboard（main.api 编译 + 缓存）。 */
  dashboard(appDir: string): { def: any; ctx: any } {
    const mtime = this.dashboardMtime(appDir);
    const hit = this.dashboardCache.get(appDir);
    if (hit && hit.mtime === mtime) return hit;
    const def = loadMainApi(appDir);
    const storage = makeFileStorage(appDir, "main.storage.json");
    const ctx = this.buildCtx(storage, def);
    const rec = { mtime, def, ctx };
    this.dashboardCache.set(appDir, rec);
    return rec;
  }

  /** 调用 app 的 main.api 方法（HTTP /api/call + 工具共用）。 */
  async call(appDir: string, method: string, args: unknown, signal?: AbortSignal): Promise<unknown> {
    const { def, ctx } = this.dashboard(appDir);
    const fn = def.api?.[method];
    if (typeof fn !== "function") throw new Error("Method not found: " + method);
    (ctx as { signal?: AbortSignal }).signal = signal;
    if (signal?.aborted) throw new Error("cancelled");
    return await fn(ctx, args ?? {});
  }

  invalidate(appDir: string): void {
    this.dashboardCache.delete(appDir);
  }

  private dashboardMtime(appDir: string): number {
    let max = 0;
    const bump = (p: string) => {
      try {
        const t = fs.statSync(p).mtimeMs;
        if (t > max) max = t;
      } catch {
        /* missing */
      }
    };
    bump(path.join(appDir, "manifest.json"));
    bump(path.join(appDir, "main.api.ts"));
    bump(path.join(appDir, "main.api.js"));
    try {
      const lib = path.join(appDir, "lib");
      for (const n of fs.readdirSync(lib)) {
        if (n.endsWith(".ts") || n.endsWith(".js")) bump(path.join(lib, n));
      }
    } catch {
      /* no lib */
    }
    return max;
  }

  private buildCtx(storage: unknown, def: any): AppContext {
    const caps = this.caps;
    const ctx: Record<string, unknown> = {
      storage,
      state: def.state || {},
      credentials: caps.credentials ? caps.credentials() : {},
      log: (...a: unknown[]) => console.log("[mini-api]", ...a),
      push: (_method: string, _params?: unknown) => {
        /* UI event bus extension */
      },
      mcp: async (name: string, args?: Record<string, unknown>) => {
        if (!caps.mcp) throw new Error("mcp: host capability not available");
        if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
        return caps.mcp(name, args);
      },
      tool: async (name: string, args?: Record<string, unknown>) => {
        if (!caps.tool) throw new Error("tool: host capability not available");
        if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
        return caps.tool(name, args);
      },
      listTools: () => (caps.listTools ? caps.listTools() : []),
      llm: async (prompt: string, opts?: Record<string, unknown>) => {
        if (!caps.llm) throw new Error("llm: host capability not available");
        const sig = (ctx as { signal?: AbortSignal }).signal;
        if (sig?.aborted) throw new Error("cancelled");
        return caps.llm(prompt, opts);
      },
      agent: async (goal: string, opts?: Record<string, unknown>) => {
        if (!caps.agent) throw new Error("agent: host capability not available");
        if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
        return caps.agent(goal, opts);
      },
      bash: async (command: string) => {
        if (!caps.bash) throw new Error("bash: host capability not available");
        if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
        return caps.bash(command);
      },
      http: (url: string | HttpRequest, opts?: Omit<HttpRequest, "url">) =>
        httpRequest(url, { ...opts, signal: (ctx as { signal?: AbortSignal }).signal }),
      system: {
        async metrics() {
          const cpus = os.cpus();
          const load = os.loadavg();
          const total = os.totalmem();
          const free = os.freemem();
          return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            uptimeSec: Math.floor(os.uptime()),
            loadavg: { "1m": load[0], "5m": load[1], "15m": load[2] },
            memory: { total, free, used: total - free, usedRatio: total ? (total - free) / total : 0 },
            cpu: { count: cpus.length, model: cpus[0]?.model || "unknown", speedMHz: cpus[0]?.speed || 0 },
            collectedAt: Date.now(),
          };
        },
      },
    };
    Object.defineProperty(ctx, "config", {
      enumerable: true,
      get: () => (caps.config ? caps.config() : publicAppConfig(this.hostConfig(), 17880)),
    });
    return ctx as unknown as AppContext;
  }
}

/** 便捷：无状态工具（git 等）由 createHost 组合注入 AppsManager。 */
export type { HostConfig };
