import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { asAppId, isAppId, type AbsolutePath, type AppId } from "../brand.ts";
import type { HostCapabilities } from "../capabilities.ts";
import { HostError } from "../errors.ts";
import type { GitHistory } from "../git/git-history.ts";
import { WorkspacePaths } from "../paths/workspace-paths.ts";
import type { AgentRunOptions } from "../agent-events.ts";
import type { AppCallContext } from "../app-runtime.ts";
import { bindCapsToContext } from "../capabilities.ts";
import type { LlmRunOptions } from "../model-call.ts";
import type { HostConfig } from "../types.ts";
import type { UiCompiler } from "../compile/ui-compiler.ts";
import {
  deleteAppFile,
  editAppFile,
  listAppFiles,
  readAppFile,
  writeAppFile,
  type Edit,
  type ListedFile,
  type MutateFileResult,
  type ReadFileRange,
  type ReadFileResult,
} from "./app-files.ts";
import { compileAppSource } from "./compile-app-source.ts";
import { httpRequest, type HttpRequest, type HttpResponse } from "./ctx-http.ts";
import { acronymOf, parseManifest, type AppManifest } from "./manifest.ts";

export type AppItem = {
  id: AppId;
  name: string;
  description: string;
  version: string;
  acronym: string;
  commits: number;
};

export type AppStorage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  table(name: string): AppStorage;
};

export type AppContext = {
  /** Reverse-DNS id of the running mini-app. */
  appId: string;
  /** Absolute runtime/apps/<appId> directory (derived from appId). */
  appDir: string;
  storage: AppStorage;
  state: Record<string, unknown>;
  credentials: Record<string, string>;
  log(...a: unknown[]): void;
  push(method: string, params?: unknown): void;
  mcp(name: string, args?: Record<string, unknown>): Promise<unknown>;
  tool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  listTools(): unknown[];
  llm(prompt: string, opts?: LlmRunOptions): Promise<string>;
  agent(goal: string, opts?: AgentRunOptions): Promise<string>;
  bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  http(url: string | HttpRequest, opts?: Omit<HttpRequest, "url">): Promise<HttpResponse>;
  system: { metrics(): Promise<Record<string, unknown>> };
  config: Record<string, unknown>;
  /** Cancel signal for the current dashboard API call. */
  signal?: AbortSignal;
};

export type DashboardMethod = (ctx: AppContext, args: unknown) => unknown | Promise<unknown>;

export type DashboardDef = {
  name: string;
  description: string;
  api: Record<string, DashboardMethod>;
  state?: Record<string, unknown>;
};

type CachedDashboard = { mtime: number; def: DashboardDef; ctx: AppContext };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defineDashboard(def: DashboardDef): DashboardDef {
  if (!def.name || !def.description) {
    throw new HostError("INVALID_DASHBOARD", "defineDashboard requires name and description");
  }
  if (!def.api || typeof def.api !== "object") {
    throw new HostError("INVALID_DASHBOARD", "defineDashboard.api must be an object");
  }
  return def;
}

function publicAppConfig(config: HostConfig): Record<string, unknown> {
  return {
    theme: config.theme,
    palette: config.palette,
    locale: config.locale,
    chatLanguage: config.chatLanguage,
    hostPort: config.hostPort,
    llm: config.llm,
  };
}

function makeFileStorage(appDir: string, fileName: string): AppStorage {
  const fp = path.join(appDir, "storage", fileName);
  const read = (): Record<string, unknown> => {
    try {
      const parsed: unknown = JSON.parse(readFileSync(fp, "utf8"));
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };
  const write = (obj: Record<string, unknown>): void => {
    mkdirSync(path.dirname(fp), { recursive: true });
    writeFileSync(fp, JSON.stringify(obj, null, 2));
  };
  return {
    async get(key: string): Promise<unknown> {
      const obj = read();
      return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
    },
    async set(key: string, value: unknown): Promise<void> {
      const obj = read();
      obj[key] = value;
      write(obj);
    },
    async delete(key: string): Promise<void> {
      const obj = read();
      delete obj[key];
      write(obj);
    },
    async clear(): Promise<void> {
      write({});
    },
    table(name: string): AppStorage {
      const safe = name.replace(/[^A-Za-z0-9_-]/g, "_");
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
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new HostError("BACKEND_IMPORT", `backend import escapes app dir: ${spec}`);
  }
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.js`,
    `${resolved}.tsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) {
      return c;
    }
  }
  throw new HostError(
    "BACKEND_IMPORT",
    `cannot resolve '${spec}' from ${path.relative(appDir, fromFile)}`,
  );
}

type CjsModule = { exports: unknown };
type CjsRequire = (spec: string) => unknown;
type CompiledFactory = (module: CjsModule, exports: unknown, require: CjsRequire) => unknown;

function asDashboardDef(value: unknown): DashboardDef {
  const exported = isRecord(value) && "default" in value ? value.default : value;
  if (!isRecord(exported)) {
    throw new HostError("INVALID_DASHBOARD", "main.api must export a dashboard");
  }
  if (typeof exported.name !== "string" || typeof exported.description !== "string") {
    throw new HostError("INVALID_DASHBOARD", "dashboard requires name and description");
  }
  if (!isRecord(exported.api)) {
    throw new HostError("INVALID_DASHBOARD", "dashboard.api must be an object");
  }
  const api: Record<string, DashboardMethod> = {};
  for (const [key, fn] of Object.entries(exported.api)) {
    if (typeof fn === "function") {
      api[key] = fn as DashboardMethod;
    }
  }
  const state = isRecord(exported.state) ? exported.state : undefined;
  return { name: exported.name, description: exported.description, api, state };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new HostError("CANCELLED", "cancelled");
  }
}

export type AfterMutateOptions = {
  commitMessage: string;
  /** Default true. Pass false to skip auto-commit. */
  commit?: boolean;
};

export type AfterMutateResult = {
  committed: { commitId: string; message: string } | null;
};

export type ReloadResult = {
  ok: boolean;
  errors: string[];
  path: string;
  compiled?: { api: boolean; ui: boolean };
  committed?: { commitId: string; message: string } | null;
};

/** Loads, registers, and executes mini-apps under WorkspacePaths.appsDir(). */
export class AppsManager {
  private readonly dashboardCache = new Map<string, CachedDashboard>();
  private uiCompiler: UiCompiler | null = null;

  constructor(
    private readonly paths: WorkspacePaths,
    private readonly capabilities: HostCapabilities,
    private readonly git: GitHistory,
    private readonly config: HostConfig,
  ) {}

  /** Wire UI compiler for invalidate + reload (createHost calls this). */
  setUiCompiler(compiler: UiCompiler): void {
    this.uiCompiler = compiler;
  }

  dirOf(appId: string): AbsolutePath {
    return this.paths.appDir(asAppId(appId));
  }

  async list(): Promise<AppItem[]> {
    const appsDir = this.paths.appsDir();
    let names: string[];
    try {
      names = readdirSync(appsDir);
    } catch {
      return [];
    }
    const out: AppItem[] = [];
    for (const name of names) {
      const full = path.join(appsDir, name);
      try {
        if (!statSync(full).isDirectory()) continue;
        if (!isAppId(name)) continue;
        const item = await this.readAppItem(name);
        if (item) out.push(item);
      } catch {
        /* skip unreadable */
      }
    }
    return out;
  }

  async get(appId: string): Promise<AppItem | null> {
    try {
      return await this.readAppItem(asAppId(appId));
    } catch {
      return null;
    }
  }

  async register(appId: string, files: Record<string, string>): Promise<AppItem> {
    const id = asAppId(appId);
    if (!files["manifest.json"]) {
      throw new HostError("MISSING_MANIFEST", "register requires manifest.json");
    }
    parseManifest(files["manifest.json"]);
    for (const [rel, content] of Object.entries(files)) {
      if (rel.includes("..") || path.isAbsolute(rel)) {
        throw new HostError("PATH_ESCAPE", `unsafe relative path: ${rel}`);
      }
      const dest = this.paths.appFile(id, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, content, "utf8");
    }
    const dir = this.dirOf(id);
    await this.afterMutate(dir, { commitMessage: "registerAppFromFiles" });
    const item = await this.readAppItem(id);
    if (!item) {
      throw new HostError("APP_NOT_FOUND", `failed to register ${id}`);
    }
    return item;
  }

  async listFiles(appId: string): Promise<ListedFile[]> {
    asAppId(appId);
    if (!(await this.get(appId))) {
      throw new HostError("APP_NOT_FOUND", `app not found: ${appId}`);
    }
    return listAppFiles(this.paths, appId);
  }

  async readFile(
    appId: string,
    relPath: string,
    range?: ReadFileRange,
  ): Promise<ReadFileResult> {
    asAppId(appId);
    if (!(await this.get(appId))) {
      throw new HostError("APP_NOT_FOUND", `app not found: ${appId}`);
    }
    return readAppFile(this.paths, appId, relPath, range);
  }

  async writeFile(
    appId: string,
    relPath: string,
    content: string,
    opts?: { commit?: boolean },
  ): Promise<MutateFileResult & AfterMutateResult> {
    asAppId(appId);
    if (!(await this.get(appId))) {
      throw new HostError("APP_NOT_FOUND", `app not found: ${appId}`);
    }
    const written = writeAppFile(this.paths, appId, relPath, content);
    const after = await this.afterMutate(this.dirOf(appId), {
      commitMessage: `write ${written.path}`,
      commit: opts?.commit,
    });
    return { ...written, ...after };
  }

  async editFile(
    appId: string,
    relPath: string,
    edits: Edit[],
    opts?: { commit?: boolean },
  ): Promise<MutateFileResult & AfterMutateResult> {
    asAppId(appId);
    if (!(await this.get(appId))) {
      throw new HostError("APP_NOT_FOUND", `app not found: ${appId}`);
    }
    const edited = editAppFile(this.paths, appId, relPath, edits);
    const after = await this.afterMutate(this.dirOf(appId), {
      commitMessage: `edit ${edited.path}`,
      commit: opts?.commit,
    });
    return { ...edited, ...after };
  }

  async deleteFile(
    appId: string,
    relPath: string,
    opts?: { commit?: boolean },
  ): Promise<{ path: string } & AfterMutateResult> {
    asAppId(appId);
    if (!(await this.get(appId))) {
      throw new HostError("APP_NOT_FOUND", `app not found: ${appId}`);
    }
    const deleted = deleteAppFile(this.paths, appId, relPath);
    const after = await this.afterMutate(this.dirOf(appId), {
      commitMessage: `delete ${deleted.path}`,
      commit: opts?.commit,
    });
    return { ...deleted, ...after };
  }

  /**
   * Validate + sync-compile api/ui. On success, auto-commit if the worktree is dirty.
   * Replaces the old lightweight mini_app_validate tool.
   */
  async reload(appId: string): Promise<ReloadResult> {
    const errors: string[] = [];
    if (!isAppId(appId)) {
      errors.push("appId must be reverse-DNS (e.g. com.example.todo)");
      return { ok: false, errors, path: "" };
    }
    const dir = this.dirOf(appId);
    const app = await this.get(appId);
    if (!app) {
      errors.push("app not registered; call mini_app_register({ appId, files })");
      return { ok: false, errors, path: dir };
    }

    const manPath = this.paths.appFile(asAppId(appId), WorkspacePaths.Rel.manifest);
    try {
      parseManifest(readFileSync(manPath, "utf8"));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      errors.push(`manifest: ${message}`);
    }

    this.invalidate(dir);

    let apiOk = false;
    try {
      const apiPath = path.join(dir, "main.api.ts");
      const apiJs = path.join(dir, "main.api.js");
      const srcPath = existsSync(apiPath) ? apiPath : apiJs;
      if (!existsSync(srcPath)) {
        errors.push("missing main.api.ts");
      } else {
        compileAppSource(readFileSync(srcPath, "utf8"));
        // Also ensure the module graph loads (relative imports).
        this.loadMainApi(dir);
        apiOk = true;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      errors.push(`main.api: ${message}`);
    }

    let uiOk = false;
    if (this.uiCompiler) {
      try {
        await this.uiCompiler.compile(dir, { locale: this.config.locale });
        uiOk = true;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        errors.push(`ui: ${message}`);
      }
    } else {
      errors.push("ui compiler not wired");
    }

    const ok = errors.length === 0;
    let committed: { commitId: string; message: string } | null = null;
    if (ok) {
      await this.git.init(dir);
      if (await this.git.isDirty(dir)) {
        try {
          const { commitId } = await this.git.commit(dir, "reload");
          committed = { commitId, message: "reload" };
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          errors.push(`commit: ${message}`);
          return {
            ok: false,
            errors,
            path: dir,
            compiled: { api: apiOk, ui: uiOk },
            committed: null,
          };
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      path: dir,
      compiled: { api: apiOk, ui: uiOk },
      committed,
    };
  }

  async afterMutate(appDir: string, opts: AfterMutateOptions): Promise<AfterMutateResult> {
    this.invalidate(appDir);
    await this.git.init(appDir);
    if (opts.commit === false) {
      return { committed: null };
    }
    try {
      const { commitId } = await this.git.commit(appDir, opts.commitMessage);
      return { committed: { commitId, message: opts.commitMessage } };
    } catch {
      return { committed: null };
    }
  }

  async remove(appId: string): Promise<void> {
    const id = asAppId(appId);
    const dir = this.dirOf(id);
    this.invalidate(dir);
    await rm(dir, { recursive: true, force: true });
  }

  load(appId: string): { def: DashboardDef; ctx: AppContext } {
    const dir = this.dirOf(appId);
    const mtime = this.dashboardMtime(dir);
    const hit = this.dashboardCache.get(dir);
    if (hit && hit.mtime === mtime) {
      return hit;
    }
    const def = this.loadMainApi(dir);
    const storage = makeFileStorage(dir, "main.storage.json");
    const ctx = this.buildCtx(storage, def, asAppId(appId));
    const rec = { mtime, def, ctx };
    this.dashboardCache.set(dir, rec);
    return rec;
  }

  async call(
    appId: string,
    method: string,
    args?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const { def, ctx } = this.load(appId);
    const fn = def.api[method];
    if (typeof fn !== "function") {
      throw new HostError("METHOD_NOT_FOUND", `Method not found: ${method}`);
    }
    ctx.signal = signal;
    throwIfAborted(signal);
    return await fn(ctx, args ?? {});
  }

  invalidate(appDir: string): void {
    this.dashboardCache.delete(appDir);
    this.uiCompiler?.invalidate(appDir);
  }

  private async readAppItem(id: AppId): Promise<AppItem | null> {
    const dir = this.dirOf(id);
    const manPath = this.paths.appFile(id, WorkspacePaths.Rel.manifest);
    let raw: string;
    try {
      raw = readFileSync(manPath, "utf8");
    } catch {
      return null;
    }
    let man: AppManifest;
    try {
      man = parseManifest(raw);
    } catch {
      return null;
    }
    const commits = await this.git.commitCount(dir);
    return {
      id,
      name: man.name,
      description: man.description ?? "",
      version: man.version,
      acronym: acronymOf(man.name, man.acronym),
      commits,
    };
  }

  private dashboardMtime(appDir: string): number {
    let max = 0;
    const bump = (p: string): void => {
      try {
        const t = statSync(p).mtimeMs;
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
      for (const n of readdirSync(lib)) {
        if (n.endsWith(".ts") || n.endsWith(".js")) {
          bump(path.join(lib, n));
        }
      }
    } catch {
      /* no lib */
    }
    return max;
  }

  private loadMainApi(appDir: string): DashboardDef {
    const loaded = new Map<string, unknown>();
    const fp = path.join(appDir, "main.api.ts");
    const fpJs = path.join(appDir, "main.api.js");
    const srcPath = existsSync(fp) ? fp : fpJs;
    if (!existsSync(srcPath)) {
      throw new HostError("MISSING_MAIN_API", "missing main.api.ts");
    }
    const exported = this.loadAppFile(srcPath, appDir, loaded);
    return asDashboardDef(exported);
  }

  private loadAppFile(file: string, appDir: string, loaded: Map<string, unknown>): unknown {
    const hit = loaded.get(file);
    if (hit !== undefined) {
      return hit;
    }
    const mod: CjsModule = { exports: {} };
    loaded.set(file, mod.exports);
    const src = compileAppSource(readFileSync(file, "utf8"));
    const req: CjsRequire = (spec: string): unknown => {
      if (spec === "@monkeyagent/dashboard") {
        return { defineDashboard, default: defineDashboard };
      }
      if (spec.startsWith(".") || spec.startsWith("lib/") || spec.startsWith("components/")) {
        const next = resolveAppModule(file, spec, appDir);
        return this.loadAppFile(next, appDir, loaded);
      }
      throw new HostError(
        "BACKEND_IMPORT",
        `backend cannot import '${spec}'. Only @monkeyagent/dashboard and relative ./lib ./components`,
      );
    };
    const fn = new Function(
      "module",
      "exports",
      "require",
      `${src}\nreturn module.exports;`,
    ) as CompiledFactory;
    const exported = fn(mod, mod.exports, req);
    const value = exported ?? mod.exports;
    loaded.set(file, value);
    return value;
  }

  private buildCtx(storage: AppStorage, def: DashboardDef, appId: AppId): AppContext {
    const caps = this.capabilities;
    const appDir = this.paths.appDir(appId);
    const box: { signal?: AbortSignal } = {};

    // Call facts for caps.*(ctx, …). signal is live via getter (set on apps.call).
    const callCtx: AppCallContext = {
      appId,
      appDir,
      hostLlm: this.config.llm ?? undefined,
    };
    Object.defineProperty(callCtx, "signal", {
      enumerable: true,
      configurable: true,
      get: () => box.signal,
    });

    const bound = bindCapsToContext(callCtx, caps);
    // Author API keeps credentials/config as properties; methods stay on bound for caps.*(ctx).
    const { credentials: getCredentials, config: getConfig, ...capMethods } = bound;

    const ctx: AppContext = {
      appId,
      appDir,
      storage,
      state: def.state ?? {},
      credentials: {},
      log: (...a: unknown[]) => {
        console.log("[mini-api]", ...a);
      },
      push: (_method: string, _params?: unknown) => {
        /* UI event bus extension */
      },
      ...capMethods,
      http: (url: string | HttpRequest, opts?: Omit<HttpRequest, "url">): Promise<HttpResponse> =>
        httpRequest(url, { ...opts, signal: box.signal }),
      system: {
        async metrics(): Promise<Record<string, unknown>> {
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
            cpu: { count: cpus.length, model: cpus[0]?.model ?? "unknown", speedMHz: cpus[0]?.speed ?? 0 },
            collectedAt: Date.now(),
          };
        },
      },
      config: {},
    };
    Object.defineProperty(ctx, "signal", {
      enumerable: true,
      get: () => box.signal,
      set: (value: AbortSignal | undefined) => {
        box.signal = value;
      },
    });
    // Live getters so a future by-scope credentials/config can change per call/app.
    Object.defineProperty(ctx, "credentials", {
      enumerable: true,
      get: () => getCredentials(),
    });
    Object.defineProperty(ctx, "config", {
      enumerable: true,
      get: () => (caps.config ? getConfig() : publicAppConfig(this.config)),
    });
    return ctx;
  }
}


