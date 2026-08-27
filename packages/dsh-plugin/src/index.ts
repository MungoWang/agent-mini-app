/**
 * Cordis plugin entry for DeepSeek Harness.
 * Standard exports: name, inject, apply(ctx), optional Config.
 *
 * @see https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish
 */
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import * as http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** commits 计数：app 无 version 概念，以 git 历史提交次数为准。带 TTL 缓存避免每次拉列表都跑 git。 */
const commitCountCache = new Map<string, { at: number; count: number }>();
const COMMIT_TTL_MS = 60_000;
export async function gitCommitCount(dir: string): Promise<number> {
  const hit = commitCountCache.get(dir);
  if (hit && Date.now() - hit.at < COMMIT_TTL_MS) return hit.count;
  let count = 0;
  try {
    const { stdout } = await execFileAsync("git", ["-C", dir, "rev-list", "--count", "HEAD"], {
      timeout: 4000,
    });
    count = parseInt(String(stdout).trim(), 10) || 0;
  } catch {
    count = 0;
  }
  commitCountCache.set(dir, { at: Date.now(), count });
  return count;
}

/** git log：id / 时间戳 / message（新→旧）。无 git 仓库返回空数组。 */
export async function gitLog(dir: string, limit: number): Promise<{ id: string; time: string; message: string }[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", dir, "log", "--format=%H%x09%ct%x09%s", "-n", String(limit)],
      { timeout: 4000 }
    );
    return String(stdout)
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf("\t");
        const idx2 = line.indexOf("\t", idx + 1);
        const id = line.slice(0, idx);
        const ct = line.slice(idx + 1, idx2);
        return {
          id,
          time: new Date(Number(ct) * 1000).toISOString(),
          message: line.slice(idx2 + 1),
        };
      });
  } catch {
    return [];
  }
}

/** 单 commit 的文件改动统计（add/del 行数；二进制或不可解析为 -1）。 */
export async function gitFileStats(dir: string, id: string): Promise<{ path: string; add: number; del: number }[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", dir, "diff-tree", "--numstat", "--no-commit-id", "-r", "--root", id],
      { timeout: 4000 }
    );
    return String(stdout)
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [a, d, ...p] = line.split("\t");
        return { path: p.join("\t"), add: a === "-" ? -1 : Number(a) || 0, del: d === "-" ? -1 : Number(d) || 0 };
      });
  } catch {
    return [];
  }
}

/** 单文件 diff 预览：最多 maxLines 行，超出省略。 */
export async function gitFilePreview(dir: string, id: string, path: string, maxLines = 18): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", dir, "show", id, "--format=", "--", path],
      { timeout: 4000 }
    );
    const lines = String(stdout).split("\n");
    if (lines.length <= maxLines) return lines.join("\n");
    return lines.slice(0, maxLines).join("\n") + `\n… (+${lines.length - maxLines} 行省略)`;
  } catch {
    return "";
  }
}

import { createRuntime } from "@monkey-mini-app/runtime-core";
import { createNodeHostPort } from "@monkey-mini-app/adapter-node";
import { createHistory } from "@monkey-mini-app/app-history";
import { createGitHistoryAdapter } from "@monkey-mini-app/app-history-git";
import {
  createAgentHandlers,
  listAgentTools,
  invokeAgentTool,
  defaultResolveAppDir,
} from "@monkey-mini-app/agent-core";
import { createUiCore } from "@monkey-mini-app/ui-core";
import { getSkillMarkdown, getSkillDir } from "@monkey-mini-app/agent-skills";
import { compileAppSource, jsonClone } from "./compile-app-source.js";
import { compileUiBundle, invalidateUiCache, resolveUiDistDir, uiBuildCacheSize } from "./compile-ui.js";
import { httpRequest } from "./ctx-http.js";
import {
  publicAppConfig,
  readHostConfig,
  writeHostConfig,
  clampPort,
  DEFAULT_HOST_CONFIG,
  type HostConfig,
} from "./host-config.js";
import {
  PALETTES,
  clampMode,
  clampPalette,
  runnerThemeCss,
  parseThemeCss,
  themeLabelFromCss,
  cssVars,
  type TokenSet,
} from "./themes.js";
import { pinyin } from "pinyin-pro";

/* —— 自定义主题：~/.monkey-mini-app/themes/theme-<id>.css —— */
export type CustomPalette = {
  id: string;
  label: string;
  swatch: string;
  custom: true;
  tokens: { light: TokenSet; dark: TokenSet };
};

export function customThemesDir(runtimeRoot: string): string {
  return path.join(path.resolve(runtimeRoot, ".."), "themes");
}

export function loadCustomPalettes(runtimeRoot: string): CustomPalette[] {
  const dir = customThemesDir(runtimeRoot);
  const out: CustomPalette[] = [];
  try {
    if (!fs.existsSync(dir)) return out;
    const names = fs.readdirSync(dir).filter((n) => /^theme-.+\.css$/.test(n));
    for (const n of names) {
      const id = n.replace(/^theme-/, "").replace(/\.css$/, "");
      const css = fs.readFileSync(path.join(dir, n), "utf8");
      const tokens = parseThemeCss(css, id);
      if (!tokens) continue;
      out.push({
        id,
        label: themeLabelFromCss(css, id),
        swatch: tokens.dark.primary,
        custom: true,
        tokens,
      });
    }
  } catch {
    /* noop */
  }
  return out;
}

/** iframe runner 用的自定义 palette CSS（一份含 light/dark 两模式） */
export function customPaletteCss(runtimeRoot: string): string {
  return loadCustomPalettes(runtimeRoot)
    .map((c) => {
      return (
        `html[data-theme="light"][data-palette="${c.id}"]{${cssVars(c.tokens.light)}}` +
        `html[data-theme="dark"][data-palette="${c.id}"]{${cssVars(c.tokens.dark)}}`
      );
    })
    .join("\n  ");
}

/* —— per-app 主题（存到 app 自己的 theme.json，null = 跟随全局） —— */
export function appThemeFile(dir: string): string {
  return path.join(dir, "theme.json");
}
export function readAppTheme(dir: string): { theme: string; palette: string } | null {
  try {
    const j = JSON.parse(fs.readFileSync(appThemeFile(dir), "utf8")) as { theme?: unknown; palette?: unknown };
    if (!j.theme) return null;
    return { theme: clampMode(j.theme), palette: typeof j.palette === "string" ? j.palette : "default" };
  } catch {
    return null;
  }
}
export function writeAppTheme(
  dir: string,
  val: { theme: string; palette: string } | null
): { theme: string; palette: string } | null {
  if (!val) {
    try {
      fs.unlinkSync(appThemeFile(dir));
    } catch {
      /* noop */
    }
    return null;
  }
  const next = { theme: clampMode(val.theme), palette: typeof val.palette === "string" ? val.palette : "default" };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(appThemeFile(dir), JSON.stringify(next, null, 2));
  return next;
}

/* handleApps 的元数据组装：manifest acronym（校验 2 位）+ git commits 数 + per-app theme */
export async function enrichAppMeta(
  app: { id: string; name?: string },
  dir: string
): Promise<Record<string, unknown>> {
  const man = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { acronym?: unknown };
    } catch {
      return {};
    }
  })();
  const manifestAcronym =
    typeof man.acronym === "string" && /^[a-zA-Z0-9]{2}$/.test(man.acronym)
      ? man.acronym.toUpperCase()
      : "";
  const commits = await gitCommitCount(dir);
  return { ...app, acronym: acronymOf(app.name, manifestAcronym), commits, theme: readAppTheme(dir) };
}

/* storage 浏览：枚举 tables（按更新时间倒序，只 .json） */
export function listStorageTables(dir: string): { name: string; size: number; updatedAt: string }[] {
  try {
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith(".json")) : [];
    return names
      .map((n) => {
        const fp = path.join(dir, n);
        const st = fs.statSync(fp);
        return { name: n.replace(/\.json$/, ""), size: st.size, updatedAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/* storage table 文件路径：basename 防目录穿越，追加 .json 后缀 */
export function storageTablePath(dir: string, table: string): string {
  return path.join(dir, path.basename(String(table ?? "")) + ".json");
}

/** 中文名 → 双字母缩写：前两个汉字拼音声母（大写）。英文名回退取前两个字母字符。 */
export function acronymOf(name: unknown, manifestAcronym: string): string {  if (manifestAcronym && /^[a-zA-Z0-9]{2}$/.test(manifestAcronym)) {
    return manifestAcronym.toUpperCase();
  }
  const s = String(name ?? "");
  if (!s) return "";
  const arr = pinyin(s, { pattern: "first", toneType: "none", type: "array" });
  return arr
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

export const name = "monkey-mini-app";

/** Wait for tools service when present (web/headless base). */
export const inject = ["tools"];

export interface Config {
  /** Absolute path or null → env MONKEY_MINI_APP_ROOT / default under home */
  runtimeRoot?: string | null;
  themeId?: string;
  /** Embedded Apps Host bind port (loopback). 0 = ephemeral. */
  hostPort?: number;
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveRuntimeRoot(cfg: Config): string {
  if (cfg.runtimeRoot) return expandHome(cfg.runtimeRoot);
  if (process.env.MONKEY_MINI_APP_ROOT) {
    return expandHome(process.env.MONKEY_MINI_APP_ROOT);
  }
  return path.join(os.homedir(), ".monkey-mini-app", "runtime");
}

function defineDashboard(def: any) {
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

const dashboardCache = new Map<string, { mtime: number; def: any; ctx: any }>();

/** Bound in apply() to the live Cordis/dsh context so RunContext can reuse host seams. */
let hostBridge: {
  bash: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  tool: (name: string, args?: Record<string, unknown>) => Promise<string>;
  mcp: (name: string, args?: Record<string, unknown>) => Promise<string>;
  llm: (prompt: string, opts?: Record<string, unknown>) => Promise<string>;
  agent: (goal: string, opts?: Record<string, unknown>) => Promise<string>;
  listTools: () => Array<Record<string, unknown>>;
  config: () => Record<string, unknown>;
  credentials: () => Record<string, string>;
} | null = null;


function snapshotDshTools(tools: any): Array<Record<string, unknown>> {
  if (!tools) return [];
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const push = (raw: any, fallbackName?: string) => {
    if (!raw) return;
    const name = String(raw.name || raw.id || fallbackName || "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const schema =
      raw.inputSchema ||
      raw.parameters ||
      raw.schema ||
      raw.input ||
      undefined;
    rows.push({
      name,
      description: String(raw.description || raw.desc || ""),
      schema: schema ?? null,
    });
  };
  const tryList = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const x of v) push(x);
      return;
    }
    if (typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) push(x, k);
    }
  };
  try {
    if (typeof tools.list === "function") tryList(tools.list());
  } catch { /* ignore */ }
  try {
    if (typeof tools.schemas === "function") tryList(tools.schemas());
  } catch { /* ignore */ }
  tryList(tools.definitions);
  tryList(tools.registry);
  if (typeof tools.keys === "function") {
    try {
      for (const k of tools.keys()) {
        try {
          push(typeof tools.get === "function" ? tools.get(k) : { name: k }, String(k));
        } catch {
          push({ name: k });
        }
      }
    } catch { /* ignore */ }
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return rows;
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Live runtime root + bound port so ctx.config / llm routing never dump dsh settings. */
let runtimeRootForConfig = "";
let boundHostPort = 17880;

function currentHostConfig(): HostConfig {
  return readHostConfig(runtimeRootForConfig || resolveRuntimeRoot({}));
}

function listenOn(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (e: Error) => reject(e);
    server.once("error", onErr);
    const start = () => {
      server.listen(port, "127.0.0.1", () => {
        server.off("error", onErr);
        resolve();
      });
    };
    if (server.listening) {
      server.close((err) => {
        if (err) {
          server.off("error", onErr);
          reject(err);
          return;
        }
        start();
      });
    } else {
      start();
    }
  });
}

function resolveLlmRoute(opts?: Record<string, unknown>) {
  const file = currentHostConfig();
  const provider =
    (typeof opts?.provider === "string" && opts.provider) || file.llm.provider;
  const model =
    (typeof opts?.model === "string" && opts.model) || file.llm.model;
  return { provider, model };
}

function withJsonInstruction(prompt: string, opts?: Record<string, unknown>) {
  if (!opts || opts.schema == null) {
    return { prompt, system: typeof opts?.system === "string" ? opts.system : undefined };
  }
  const schemaText = JSON.stringify(opts.schema);
  const system = [
    typeof opts.system === "string" ? opts.system : "",
    "Return ONLY a JSON object matching this JSON Schema. No markdown fences, no preamble.",
    schemaText,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { prompt, system };
}

/** When opts.schema is set, peel markdown / preamble so JSON.parse in apps can succeed. */
function coerceSchemaJson(text: string, opts?: Record<string, unknown>): string {
  if (!opts || opts.schema == null) return text;
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  if (body.startsWith("{") || body.startsWith("[")) return body;
  const startObj = body.indexOf("{");
  const endObj = body.lastIndexOf("}");
  if (startObj >= 0 && endObj > startObj) return body.slice(startObj, endObj + 1);
  const startArr = body.indexOf("[");
  const endArr = body.lastIndexOf("]");
  if (startArr >= 0 && endArr > startArr) return body.slice(startArr, endArr + 1);
  return body;
}

async function collectLlmStream(
  llmSvc: { stream: (req: unknown) => AsyncIterable<unknown> },
  prompt: string,
  route: { provider: string; model: string },
  opts?: Record<string, unknown>
) {
  const { prompt: text, system } = withJsonInstruction(prompt, opts);
  const req = {
    provider: route.provider,
    model: route.model,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
    system,
    maxTokens: (opts && opts.maxTokens) || 1024,
  };
  const acc: string[] = [];
  let sawDelta = false;
  const iter = llmSvc.stream(req);
  for await (const chunk of iter as AsyncIterable<any>) {
    if (!chunk) continue;
    const type = chunk.type;
    // Only the visible text stream counts. reasoning-* / usage / block-start
    // chunks carry their own text and must be ignored (they are not the answer).
    if (type === "text-delta" && typeof chunk.text === "string") {
      sawDelta = true;
      acc.push(chunk.text);
    } else if (
      type === "block-end" &&
      chunk.block &&
      typeof chunk.block.text === "string"
    ) {
      // dsh streams both incremental deltas AND a final full block — only use
      // the block when the stream had no deltas, else the text doubles up.
      if (!sawDelta) acc.push(chunk.block.text);
    }
  }  const out = acc.join("");
  if (!out) throw new Error("llm stream empty");
  return coerceSchemaJson(out, opts);
}

async function llmViaOpenAICompat(prompt: string, opts?: Record<string, unknown>) {
  const key = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "llm unavailable: no dsh model service bound and no DEEPSEEK_API_KEY/OPENAI_API_KEY"
    );
  }
  const base = (
    process.env.DEEPSEEK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.deepseek.com"
  ).replace(/\/$/, "");
  const model =
    (typeof opts?.model === "string" && opts.model) ||
    process.env.DEEPSEEK_MODEL ||
    process.env.OPENAI_MODEL ||
    "deepseek-chat";
  const messages: Array<{ role: string; content: string }> = [];
  if (typeof opts?.system === "string" && opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: prompt });
  const body: Record<string, unknown> = { model, messages };
  if (opts && opts.schema != null) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`llm http ${res.status}: ${stringifyToolResult(j)}`);
  }
  const text = j?.choices?.[0]?.message?.content;
  if (text == null) throw new Error("llm empty response: " + stringifyToolResult(j));
  return String(text);
}

function createHostBridge(cordisCtx: LooseCtx) {
  const get = (name: string) => {
    try {
      if (typeof cordisCtx.get === "function") return cordisCtx.get(name);
    } catch {
      /* ignore */
    }
    return (cordisCtx as any)[name];
  };

  const bash = async (command: string) => {
    // Prefer local bash: dsh shell.run requires sandbox policy and often throws
    // "Cannot destructure property 'mode' of 'policy'".
    try {
      const { stdout, stderr } = await execFileAsync("bash", ["-c", command], {
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      });
      return {
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        exitCode: 0,
      };
    } catch (e: any) {
      if (e && (e.stdout != null || e.stderr != null || typeof e.code === "number")) {
        return {
          stdout: String(e.stdout ?? ""),
          stderr: String(e.stderr ?? e.message ?? e),
          exitCode: typeof e.code === "number" ? e.code : 1,
        };
      }
    }
    const shell = get("shell");
    if (shell && typeof shell.run === "function") {
      try {
        const r: any = await shell.run({ command, description: "mini-app bash" });
        return {
          stdout: String(r?.stdout ?? r?.output ?? ""),
          stderr: String(r?.stderr ?? ""),
          exitCode: Number(r?.exitCode ?? r?.code ?? 0),
        };
      } catch {
        /* fall through */
      }
    }
    throw new Error("bash unavailable");
  };

  const findTool = (name: string) => {
    const tools = get("tools") || cordisCtx.tools;
    if (!tools) return null;
    const candidates = [
      name,
      name.startsWith("mcp__") ? name : null,
      `mcp__${name}`,
    ].filter(Boolean) as string[];
    // Prefer registry getters
    for (const n of candidates) {
      if (typeof tools.get === "function") {
        try {
          const t = tools.get(n);
          if (t) return { tools, tool: t, name: n };
        } catch {
          /* ignore */
        }
      }
    }
    // schemas / list style
    const list =
      (typeof tools.schemas === "function" && tools.schemas()) ||
      (typeof tools.list === "function" && tools.list()) ||
      tools.definitions ||
      null;
    if (Array.isArray(list)) {
      for (const n of candidates) {
        const hit = list.find((x: any) => x?.name === n || x?.name?.endsWith(`__${name}`));
        if (hit) return { tools, tool: hit, name: hit.name || n };
      }
      // bare MCP name match suffix
      const hit = list.find(
        (x: any) => typeof x?.name === "string" && x.name.endsWith(`__${name}`)
      );
      if (hit) return { tools, tool: hit, name: hit.name };
    }
    return { tools, tool: null, name };
  };

  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const found = findTool(name);
    if (!found?.tools) throw new Error("tool: ctx.tools not available");
    const { tools, tool: t, name: resolved } = found;
    const payload = jsonClone(args && typeof args === "object" ? args : {}, {});
    const signal = AbortSignal.timeout(120_000);
    const stubExec = {
      signal,
      deferContext() {},
      concludeTurn() {},
    };
    // Prefer the tool body. dsh ToolRuntime.execute() takes ToolExecutionInput
    // ({ name, arguments, callId, signal }), NOT (name, args). Calling the
    // scheduler with a string name makes arguments=undefined and throws
    // "tool execution arguments must be losslessly JSON-serializable".
    // Direct body also bypasses code-mode collapse (native names denied without parent).
    if (t && typeof t.execute === "function") {
      return stringifyToolResult(await t.execute(payload, stubExec));
    }
    if (typeof tools.execute === "function") {
      return stringifyToolResult(
        await tools.execute({
          name: resolved || name,
          arguments: payload,
          callId: `mma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          signal,
        })
      );
    }
    if (typeof tools.invoke === "function") {
      return stringifyToolResult(await tools.invoke(resolved || name, payload));
    }
    if (typeof tools.call === "function") {
      return stringifyToolResult(await tools.call(resolved || name, payload));
    }
    if (t && typeof t.run === "function") {
      return stringifyToolResult(await t.run(payload));
    }
    throw new Error(
      `tool '${name}' not invokable (resolved=${resolved}); dsh tools registry API not matched`
    );
  };

  const mcp = async (name: string, args?: Record<string, unknown>) => {
    // Protocol: plain name without mcp_ prefix; dsh registers mcp__server__rawName
    const plain = String(name || "").replace(/^mcp_/, "");
    try {
      return await tool(plain, args || {});
    } catch (e1) {
      try {
        return await tool(`mcp__${plain}`, args || {});
      } catch {
        throw e1;
      }
    }
  };

  const llm = async (prompt: string, opts?: Record<string, unknown>) => {
    const llmSvc = get("llm") || get("model") || get("chat");
    const route = resolveLlmRoute(opts);
    const framed = withJsonInstruction(prompt, opts);
    if (llmSvc && typeof llmSvc.stream === "function") {
      try {
        return await collectLlmStream(llmSvc, prompt, route, opts);
      } catch (e: any) {
        console.warn("[mini-api] ctx.llm.stream failed", e && e.message ? e.message : e);
      }
    }
    if (llmSvc) {
      if (typeof llmSvc.complete === "function") {
        return coerceSchemaJson(
          stringifyToolResult(
            await llmSvc.complete(framed.prompt, { ...opts, ...route, system: framed.system })
          ),
          opts
        );
      }
      if (typeof llmSvc.chat === "function") {
        return coerceSchemaJson(
          stringifyToolResult(
            await llmSvc.chat([{ role: "user", content: framed.prompt }], {
              ...opts,
              ...route,
              system: framed.system,
            })
          ),
          opts
        );
      }
      if (typeof llmSvc.generate === "function") {
        return coerceSchemaJson(
          stringifyToolResult(
            await llmSvc.generate(framed.prompt, { ...opts, ...route, system: framed.system })
          ),
          opts
        );
      }
      if (typeof llmSvc === "function") {
        return coerceSchemaJson(
          stringifyToolResult(await llmSvc(framed.prompt, { ...opts, ...route })),
          opts
        );
      }
    }
    return coerceSchemaJson(
      await llmViaOpenAICompat(framed.prompt, { ...opts, ...route, system: framed.system }),
      opts
    );
  };

  const agent = async (goal: string, opts?: Record<string, unknown>) => {
    const agents = get("agents") || get("subagents");
    if (agents && typeof agents.run === "function") {
      return stringifyToolResult(await agents.run(goal, opts));
    }
    if (agents && typeof agents.spawn === "function") {
      return stringifyToolResult(await agents.spawn({ goal, ...(opts || {}) }));
    }
    // Lightweight fallback: single-shot llm framed as agent goal
    const maxIterations =
      typeof opts?.maxIterations === "number" ? opts.maxIterations : 1;
    let last = "";
    for (let i = 0; i < Math.max(1, maxIterations); i++) {
      last = await llm(
        `You are a local agent. Goal:\n${goal}\n\nRespond with the final answer only.`,
        opts
      );
    }
    return last;
  };

  const config = () => publicAppConfig(currentHostConfig(), boundHostPort);

  const credentials = () => {
    const cred = get("credentials");
    if (!cred) return {};
    if (typeof cred.getAll === "function") return cred.getAll() || {};
    if (typeof cred === "object") return { ...(cred as Record<string, string>) };
    return {};
  };

  const listTools = () => snapshotDshTools(get("tools") || (cordisCtx as any).tools);
  return { bash, tool, mcp, llm, agent, listTools, config, credentials };
}

let lastUiWarmAt = 0;
const UI_WARM_TTL_MS = 60_000;

/** Background-compile every registered app's UI bundle (throttled). */
async function warmUiBundles(runtimeRoot: string): Promise<void> {
  const now = Date.now();
  if (now - lastUiWarmAt < UI_WARM_TTL_MS) return;
  lastUiWarmAt = now;
  try {
    const appsDir = path.join(runtimeRoot, "apps");
    const dirs = fs.existsSync(appsDir) ? fs.readdirSync(appsDir) : [];
    await Promise.all(
      dirs.map(async (id) => {
        try {
          await compileUiBundle(path.join(appsDir, id));
        } catch (e) {
          console.warn("[monkey-mini-app] ui warm failed", id, String((e as Error)?.message || e).slice(0, 120));
        }
      })
    );
  } catch {
    /* warm is best-effort */
  }
}

function dashboardMtime(appDir: string): number {
  let max = 0;
  const bump = (fp: string) => {
    try {
      const t = fs.statSync(fp).mtimeMs;
      if (t > max) max = t;
    } catch {
      /* missing */
    }
  };
  bump(path.join(appDir, "main.api.ts"));
  bump(path.join(appDir, "main.api.js"));
  try {
    const libDir = path.join(appDir, "lib");
    for (const name of fs.readdirSync(libDir)) {
      if (/\.(ts|js)$/.test(name)) bump(path.join(libDir, name));
    }
  } catch {
    /* no lib/ */
  }
  return max;
}

function getDashboard(appDir: string) {
  const mtime = dashboardMtime(appDir);
  const hit = dashboardCache.get(appDir);
  if (hit && hit.mtime === mtime) return hit;
  const def = loadMainApi(appDir);
  const storage = makeFileStorage(appDir, "main.storage.json");
  const bridge = hostBridge;
  const ctx: Record<string, unknown> = {
    storage,
    state: def.state || {},
    credentials: bridge ? bridge.credentials() : {},
    log: (...a: unknown[]) => console.log("[mini-api]", ...a),
    push: (_method: string, _params?: unknown) => {
      /* UI event bus extension; host UI may subscribe later */
    },
    mcp: async (name: string, args?: Record<string, unknown>) => {
      if (!bridge) throw new Error("mcp: host bridge not ready");
      if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
      return bridge.mcp(name, args);
    },
    tool: async (name: string, args?: Record<string, unknown>) => {
      if (!bridge) throw new Error("tool: host bridge not ready");
      if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
      return bridge.tool(name, args);
    },
    listTools: () => (bridge ? bridge.listTools() : []),
    llm: async (prompt: string, opts?: Record<string, unknown>) => {
      if (!bridge) throw new Error("llm: host bridge not ready");
      const sig = (ctx as { signal?: AbortSignal }).signal;
      if (sig?.aborted) throw new Error("cancelled");
      return bridge.llm(prompt, opts);
    },
    agent: async (goal: string, opts?: Record<string, unknown>) => {
      if (!bridge) throw new Error("agent: host bridge not ready");
      if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
      return bridge.agent(goal, opts);
    },
    bash: async (command: string) => {
      if (!bridge) throw new Error("bash: host bridge not ready");
      if ((ctx as { signal?: AbortSignal }).signal?.aborted) throw new Error("cancelled");
      return bridge.bash(command);
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
          memory: {
            total,
            free,
            used: total - free,
            usedRatio: total ? (total - free) / total : 0,
          },
          cpu: {
            count: cpus.length,
            model: cpus[0]?.model || "unknown",
            speedMHz: cpus[0]?.speed || 0,
          },
          collectedAt: Date.now(),
        };
      },
    },
  };
  Object.defineProperty(ctx, "config", {
    enumerable: true,
    get: () =>
      bridge
        ? bridge.config()
        : publicAppConfig(currentHostConfig(), boundHostPort),
  });
  const rec = { mtime, def, ctx };
  dashboardCache.set(appDir, rec);
  return rec;
}

function asToolObject(value: unknown): Record<string, unknown> {
  const v = jsonClone(value, value);
  if (v == null) return { ok: true };
  if (Array.isArray(v)) return { items: v };
  if (typeof v !== "object") return { value: v };
  return v as Record<string, unknown>;
}

async function callMainApi(appDir: string, method: string, args: unknown, signal?: AbortSignal) {
  const { def, ctx } = getDashboard(appDir);
  const fn = def.api?.[method];
  if (typeof fn !== "function") throw new Error("Method not found: " + method);
  // Expose the current call's abort signal to the app (ctx.signal). The ctx is
  // cached per app; overwriting is fine because scan-style flows take a lock.
  (ctx as { signal?: AbortSignal }).signal = signal;
  if (signal?.aborted) throw new Error("cancelled");
  return await fn(ctx, args ?? {});
}

function appRunnerHtml(appId: string): string {
  const safe = JSON.stringify(appId);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${appId}</title>
<style>
  ${runnerThemeCss() + customPaletteCss(runtimeRootForConfig || "")}
  html,body,#root{margin:0;height:100%;background:var(--background);color:var(--foreground);font-family:var(--font-sans);}
  .err{padding:24px;color:#b91c1c;white-space:pre-wrap;}
  #root.boot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
  #root.boot .art{position:relative;width:88px;height:72px;color:var(--foreground);}
  #root.boot .art svg{display:block;width:88px;height:64px;}
  #root.boot .dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}
  #root.boot .dots i{width:6px;height:6px;border-radius:50%;background:var(--primary);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}
  #root.boot .dots i:nth-child(2){animation-delay:.15s;}
  #root.boot .dots i:nth-child(3){animation-delay:.3s;}
  @keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}
</style>
</head>
<body>
<div id="root" class="boot" role="status" aria-label="加载中">
  <div class="art" aria-hidden="true">
    <svg viewBox="0 0 88 64" fill="none">
      <rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>
      <rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>
      <circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>
      <rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>
      <rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>
      <rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>
      <rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>
      <path d="M62 40c6 0 10 5 10 10" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
      <circle cx="72" cy="50" r="3.2" fill="var(--primary)" opacity=".9"/>
    </svg>
    <div class="dots"><i></i><i></i><i></i></div>
  </div>
</div>
<script type="module">
const APP_ID = ${safe};
(() => {
  const q = new URLSearchParams(location.search);
  const th = q.get("theme") || "light";
  const pal = q.get("palette") || "default";
  const dock = q.get("dock") || "fill";
  document.documentElement.setAttribute("data-theme", th);
  document.documentElement.classList.toggle("dark", th === "dark");
  document.documentElement.setAttribute("data-palette", pal);
  document.documentElement.setAttribute("data-dock", dock);
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.type !== "mma-set-env") return;
    if (d.theme) {
      document.documentElement.setAttribute("data-theme", d.theme);
      document.documentElement.classList.toggle("dark", d.theme === "dark");
    }
    if (d.palette) document.documentElement.setAttribute("data-palette", d.palette);
    if (d.dock) document.documentElement.setAttribute("data-dock", d.dock);
  });
})();
const cssLink = document.createElement("link");
cssLink.rel = "stylesheet";
cssLink.href = "/ui.css";
document.head.appendChild(cssLink);

// 编译后的 app bundle 完全自包含（react + 组件 + useDashboardApi 都在里面），
// 这里只需要按 id 加载。失败时展示可读错误。
try {
  await import("/api/app/" + encodeURIComponent(APP_ID) + "/ui/entry.js");
} catch (e) {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.className = "err";
    rootEl.textContent = String((e && (e.stack || e.message)) || e);
  }
}
</script>
</body>
</html>`;
}

type LooseCtx = {
  tools?: {
    register: (tool: unknown) => void | (() => void);
    get?: (name: string) => unknown;
    execute?: (name: string, args: unknown) => Promise<unknown>;
    invoke?: (name: string, args: unknown) => Promise<unknown>;
    call?: (name: string, args: unknown) => Promise<unknown>;
    schemas?: () => unknown[];
    list?: () => unknown[];
  };
  get?: (name: string) => unknown;
  effect?: (fn: () => void | (() => void)) => void;
  on?: (...args: unknown[]) => void;
  provide?: (key: string, value: unknown) => void;
  inject?: (deps: string[], fn: (scope: LooseCtx) => void) => void;
  [key: string]: unknown;
};

/**
 * Cordis apply entry. Registrations should be reversible via returned disposers / ctx.effect.
 */
export async function apply(ctx: LooseCtx, config: Config = {}) {
  const runtimeRoot = resolveRuntimeRoot(config);
  runtimeRootForConfig = runtimeRoot;
  const saved = readHostConfig(runtimeRoot);
  const themeId = config.themeId ?? saved.theme;

  // Wire RunContext to live dsh seams (shell / tools / model when present)
  hostBridge = createHostBridge(ctx);
  console.log("[monkey-mini-app] host bridge ready (bash/http/tool/mcp/llm/agent)");

  const host = createNodeHostPort({ runtimeRoot });
  const history = createHistory(createGitHistoryAdapter());
  const runtime = await createRuntime({ host, history, themeId });
  const handlers = createAgentHandlers({
    runtime,
    runtimeRoot,
    resolveAppDir: (id) => defaultResolveAppDir(runtimeRoot, id),
  });
  const pendingOpen: { current: { appId: string; title?: string; at: number } | null } = {
    current: null,
  };
  const origOpen = handlers.mini_app_open.bind(handlers);
  handlers.mini_app_open = async (input) => {
    const out = await origOpen(input);
    pendingOpen.current = {
      appId: input.appId,
      title: input.title,
      at: Date.now(),
    };
    return out && typeof out === "object" && !Array.isArray(out) ? out : { ok: true, tab: out };
  };
  handlers.mini_app_call = async (input, signal) => {
    const appId = String(input.appId || "");
    const method = String(input.method || "");
    try {
      const value = await callMainApi(
        defaultResolveAppDir(runtimeRoot, appId),
        method,
        input.args || {},
        signal
      );
      return { ok: true, value };
    } catch (e) {
      if (signal?.aborted) return { ok: false, error: "cancelled", cancelled: true };
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  };
  const ui = createUiCore(runtime);
  await ui.refresh();

  // Expose for other plugins / diagnostics (Cordis requires provide, not bare assign)
  const service = {
    runtime,
    ui,
    handlers,
    runtimeRoot,
    skillDir: getSkillDir(),
    skillMarkdown: getSkillMarkdown(),
  };
  if (typeof ctx.provide === "function") {
    ctx.provide("monkeyMiniApp", service);
  }

  const disposers: Array<() => void> = [];

  const tools = listAgentTools();
  // Prefer host-provided defineTool (from @deepseek-ai/dsh-tools)
  let defineTool: null | ((opts: Record<string, unknown>) => unknown) = null;
  try {
    // Resolved from the running dsh installation, not this package
    const mod = await import(
      /* @vite-ignore */ "@deepseek-ai/dsh-tools"
    );
    defineTool = (mod as { defineTool?: (opts: Record<string, unknown>) => unknown })
      .defineTool ?? null;
  } catch {
    defineTool = null;
  }

  if (ctx.tools?.register) {
    for (const toolDef of tools) {
      const props = (toolDef.inputSchema?.properties ?? {}) as Record<
        string,
        { type?: string; description?: string }
      >;
      const required = new Set(
        ((toolDef.inputSchema as { required?: string[] })?.required) ?? []
      );
      const parameters: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(props)) {
        parameters[key] = {
          type: schema.type ?? "string",
          required: required.has(key),
          description: schema.description ?? key,
        };
      }
      const toolName = toolDef.name;
      const built = defineTool
        ? defineTool({
            name: toolName,
            description: toolDef.description,
            parameters,
            output: {
              schema: { type: "object", additionalProperties: true },
              render: (_args: unknown, value: unknown) => [
                {
                  type: "text",
                  text:
                    typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2),
                },
              ],
            },
            async execute(args: Record<string, unknown>, toolCtx?: { signal?: AbortSignal }) {
              return asToolObject(
                await invokeAgentTool(handlers, toolName, args ?? {}, toolCtx?.signal)
              );
            },
          })
        : {
            name: toolName,
            description: toolDef.description,
            parameters,
            output: {
              schema: { type: "object", additionalProperties: true },
              render: (_args: unknown, value: unknown) => [
                {
                  type: "text",
                  text: JSON.stringify(value, null, 2),
                },
              ],
            },
            async execute(args: Record<string, unknown>, toolCtx?: { signal?: AbortSignal }) {
              return asToolObject(
                await invokeAgentTool(handlers, toolName, args ?? {}, toolCtx?.signal)
              );
            },
          };
      try {
        const ret = ctx.tools.register(built);
        if (typeof ret === "function") disposers.push(ret);
      } catch (e) {
        console.warn(
          `[monkey-mini-app] tools.register failed for ${toolName}:`,
          e
        );
      }
    }
    try {
      const extra = {
            name: "mini_app_list_ctx_tools",
            description:
              "List live dsh tools for ctx.tool(name, args) inside main.api.ts. Call ONLY when the app will use ctx.tool. Skip for storage/bash/llm-only apps.",
            parameters: {},
            output: {
              schema: { type: "object", additionalProperties: true },
              render: (_args: unknown, value: unknown) => [
                { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
              ],
            },
            async execute() {
              const toolsSvc = (ctx as any).tools;
              const listed = snapshotDshTools(toolsSvc);
              return {
                count: listed.length,
                note: "These names are for ctx.tool(name, args) inside main.api.ts. Prefer storage/bash/llm when possible.",
                tools: listed,
              };
            },
          };
      const ret = ctx.tools.register(extra);
      if (typeof ret === "function") disposers.push(ret);
    } catch (e) {
      console.warn("[monkey-mini-app] register mini_app_list_ctx_tools failed", e);
    }
  } else {
    console.warn(
      "[monkey-mini-app] ctx.tools missing; inject=['tools'] required for model-facing tools"
    );
  }


  // Install skill into user skills dir so dsh skill tool can discover it without reading source
  try {
    const skillSrc = getSkillDir();
    const skillDst = path.join(os.homedir(), ".dsh", "skills", "monkey-mini-app");
    fs.mkdirSync(path.dirname(skillDst), { recursive: true });
    fs.cpSync(skillSrc, skillDst, { recursive: true });
  } catch (e) {
    console.warn("[monkey-mini-app] skill install skipped:", e);
  }

  // HTTP for dashboard — dsh webServer.register({ kind, path, handler })
  const handleApps = async () => {
    try {
      const out = (await handlers.mini_app_list({})) as { apps?: any[]; runtimeRoot?: string };
      const apps = Array.isArray(out?.apps) ? out.apps : [];
      // 自包含：不引用外部 appDirOf（esbuild 对前向引用重命名不可靠）
      const dirOf = (appId: string) => path.join(runtimeRoot, "apps", appId);
      const withMeta = await Promise.all(
        apps.map(async (a: any) => {
          const dir = dirOf(a.id);
          return enrichAppMeta(a, dir);
        })
      );
      // 后台预热 UI bundle（fire-and-forget，节流 60s）——首次打开 app 不再等编译
      void warmUiBundles(runtimeRoot);
      return { apps: withMeta };
    } catch (e) {
      return { apps: [], error: String(e) };
    }
  };
  const sendJson = (res: any, data: unknown) => {
    const body = JSON.stringify(data);
    if (res && typeof res.writeHead === "function") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
      return;
    }
    if (res && typeof res.json === "function") {
      res.json(data);
      return;
    }
    if (res && typeof res.end === "function") {
      try {
        res.setHeader?.("Content-Type", "application/json; charset=utf-8");
      } catch {
        /* ignore */
      }
      res.end(body);
    }
  };
  const appsHandler = async (req: unknown, res: unknown) => {
    const data = await handleApps();
    return sendJson(res, data);
  };
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["webServer"], (scope) => {
        const ws = (scope as { webServer?: { register?: Function } }).webServer;
        if (typeof ws?.register !== "function") {
          console.warn("[monkey-mini-app] webServer.register missing");
          return;
        }
        try {
          ws.register({
            kind: "exact",
            path: "/api/monkey-mini-app/apps",
            handler: appsHandler,
          });
          console.log("[monkey-mini-app] route exact /api/monkey-mini-app/apps");
        } catch (e1) {
          try {
            ws.register({
              kind: "prefix",
              path: "/api/monkey-mini-app",
              handler: async (req: any, res: any) => {
                const url = String(req?.url || req?.path || "");
                if (url.includes("/apps")) return appsHandler(req, res);
                if (res && typeof res.writeHead === "function") {
                  res.writeHead(404);
                  res.end("not found");
                }
              },
            });
            console.log("[monkey-mini-app] route prefix /api/monkey-mini-app");
          } catch (e2) {
            try {
              ws.register("/api/monkey-mini-app/apps", appsHandler);
              console.log("[monkey-mini-app] route string /api/monkey-mini-app/apps");
            } catch (e3) {
              console.warn("[monkey-mini-app] webServer register failed", e1, e2, e3);
            }
          }
        }
      });
    } catch (e) {
      console.warn("[monkey-mini-app] webServer optional inject skipped", e);
    }
  }

  // Embedded Apps Host — plugin-owned, no extra process / run-demo.sh
  let hostPort = saved.hostPort;
  if (config.hostPort != null) {
    try {
      hostPort = clampPort(config.hostPort);
    } catch {
      /* keep saved */
    }
  }
  const appsHost = http.createServer(async (req, res) => {
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
    const appDirOf = (appId: string) => path.join(runtimeRoot, "apps", appId);
    const readJsonSafe = (p: string, fallback: unknown) => {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        return fallback;
      }
    };
    const storageFile = (appId: string) => path.join(appDirOf(appId), "storage", "default.json");
    try {
      if (url.pathname === "/ui.css") {
        try {
          const css = fs.readFileSync(path.join(resolveUiDistDir(), "globals.css"), "utf8");
          send(200, css, "text/css; charset=utf-8");
        } catch (e) {
          send(500, "ui.css missing: " + e, "text/plain");
        }
        return;
      }
      // demo-host gallery (apps/demo-host build output) — set MONKEY_MINI_APP_DEMO_DIR
      // to override; falls back to the repo path when running from a checkout.
      if (url.pathname === "/demo" || url.pathname.startsWith("/demo/")) {
        const demoRoot =
          process.env.MONKEY_MINI_APP_DEMO_DIR ||
          path.join(MODULE_DIR, "..", "..", "..", "apps", "demo-host", "dist");
        const rel =
          url.pathname === "/demo"
            ? "index.html"
            : decodeURIComponent(url.pathname.slice("/demo/".length));
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
      // per-app compiled UI bundle (main entry.js + lazy chunks)
      const uiBuildMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/ui\/([^/]+)$/);
      if (uiBuildMatch) {
        const appId = decodeURIComponent(uiBuildMatch[1]);
        const name = decodeURIComponent(uiBuildMatch[2]);
        const appDir = appDirOf(appId);
        const files = await compileUiBundle(appDir);
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
      // raw ui dist assets (src/vendor/index.js/globals.css) for debugging
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
      if (url.pathname === "/health") {
        send(200, JSON.stringify({ ok: true, runtimeRoot, hostPort: boundHostPort }));
        return;
      }
      if (url.pathname === "/api/host-config" && req.method === "GET") {
        send(
          200,
          JSON.stringify({ ok: true, ...publicAppConfig(currentHostConfig(), boundHostPort) })
        );
        return;
      }
      if (url.pathname === "/api/host-config" && req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
          hostPort?: number;
          theme?: string;
          palette?: string;
          chatLanguage?: string;
          llm?: { provider?: string; model?: string };
        };
        const cur = currentHostConfig();
        const next: HostConfig = {
          hostPort: body.hostPort != null ? clampPort(body.hostPort) : cur.hostPort,
          theme: body.theme === "dark" ? "dark" : body.theme === "light" ? "light" : cur.theme,
          palette: body.palette != null ? clampPalette(body.palette) : cur.palette,
          chatLanguage: body.chatLanguage === "en" ? "en" : body.chatLanguage === "zh" ? "zh" : cur.chatLanguage,
          llm: {
            provider: String(body.llm?.provider || cur.llm.provider),
            model: String(body.llm?.model || cur.llm.model),
          },
        };
        const portChanged = next.hostPort !== boundHostPort;
        if (portChanged) {
          const probe = http.createServer();
          try {
            await listenOn(probe, next.hostPort);
            await new Promise<void>((resolve, reject) =>
              probe.close((err) => (err ? reject(err) : resolve()))
            );
          } catch (e) {
            send(
              409,
              JSON.stringify({
                ok: false,
                error: "port in use or bind failed: " + String((e as Error).message || e),
                hostPort: boundHostPort,
                ...publicAppConfig(cur, boundHostPort),
              })
            );
            return;
          }
        }
        const savedCfg = writeHostConfig(runtimeRoot, next);
        send(
          200,
          JSON.stringify({
            ok: true,
            ...publicAppConfig(savedCfg, portChanged ? next.hostPort : boundHostPort),
          })
        );
        if (portChanged) {
          const target = next.hostPort;
          setImmediate(() => {
            listenOn(appsHost, target)
              .then(() => {
                boundHostPort = target;
                console.log("[monkey-mini-app] apps host rebound http://127.0.0.1:" + target);
              })
              .catch((e) => {
                console.warn("[monkey-mini-app] rebound failed", e);
              });
          });
        }
        return;
      }
      if (url.pathname === "/api/llm-config" && req.method === "GET") {
        const c = currentHostConfig();
        send(200, JSON.stringify({ ok: true, ...c.llm, defaults: DEFAULT_HOST_CONFIG.llm }));
        return;
      }
      if (url.pathname === "/api/llm-config" && req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        const cur = currentHostConfig();
        const savedCfg = writeHostConfig(runtimeRoot, {
          ...cur,
          llm: {
            provider: String(body.provider || cur.llm.provider),
            model: String(body.model || cur.llm.model),
          },
        });
        send(200, JSON.stringify({ ok: true, ...savedCfg.llm }));
        return;
      }
      if (url.pathname === "/api/ctx-tools" || url.pathname === "/api/monkey-mini-app/ctx-tools") {
        const listed = hostBridge?.listTools?.() ?? [];
        send(200, JSON.stringify({ ok: true, count: listed.length, tools: listed }));
        return;
      }
      if (url.pathname === "/api/palettes") {
        const builtin = PALETTES.map((p) => ({ id: p.id, label: p.label, swatch: p.swatch, custom: false }));
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
        send(200, JSON.stringify(await handleApps()));
        return;
      }
      if (url.pathname === "/api/pending-open" && req.method === "GET") {
        send(200, JSON.stringify(pendingOpen.current || {}));
        return;
      }
      if (url.pathname === "/api/pending-open/ack" && req.method === "POST") {
        pendingOpen.current = null;
        send(200, JSON.stringify({ ok: true }));
        return;
      }
      // —— app 提交历史 / storage 浏览 ——
      const histMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/history(?:\/([a-f0-9]{7,}))?$/);
      if (histMatch) {
        const appId = decodeURIComponent(histMatch[1]);
        const commitId = histMatch[2];
        const dir = appDirOf(appId);
        if (commitId) {
          const stats = await gitFileStats(dir, commitId);
          const log = await gitLog(dir, 200);
          const meta = log.find((c) => c.id === commitId);
          const files = await Promise.all(
            stats.map(async (s) => ({ ...s, preview: await gitFilePreview(dir, commitId, s.path) }))
          );
          send(
            200,
            JSON.stringify({
              ok: true,
              commit: {
                id: commitId,
                time: meta?.time || "",
                message: meta?.message || "",
                files,
              },
            })
          );
        } else {
          const limit = Math.min(Number(new URL(req.url || "/", "http://127.0.0.1").searchParams.get("limit")) || 50, 200);
          const list = await gitLog(dir, limit);
          const withStats = await Promise.all(
            list.map(async (c) => ({ ...c, files: await gitFileStats(dir, c.id) }))
          );
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
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
            theme?: string;
            palette?: string;
            reset?: boolean;
          };
          const saved = body.reset
            ? writeAppTheme(dir, null)
            : writeAppTheme(dir, { theme: body.theme || "light", palette: body.palette || "default" });
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
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
          appId?: string;
          method?: string;
          args?: { key?: string; value?: unknown };
        };
        const appId = body.appId || "";
        const method = body.method || "";
        const file = storageFile(appId);
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
          const fp = path.join(appDirOf(appId), "storage", path.basename(name));
          send(200, JSON.stringify({ ok: true, value: readJsonSafe(fp, {}) }));
          return;
        }
        if (method === "storage.setFile") {
          const name = String(body.args?.key || "default.json");
          const fp = path.join(appDirOf(appId), "storage", path.basename(name));
          fs.mkdirSync(path.dirname(fp), { recursive: true });
          fs.writeFileSync(fp, JSON.stringify(body.args?.value ?? {}, null, 2));
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
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
          appId?: string;
          method?: string;
          args?: unknown;
        };
        try {
          const value = await callMainApi(appDirOf(String(body.appId || "")), String(body.method || ""), body.args);
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
        send(200, JSON.stringify({ ok: true, appId }));
        return;
      }
      const appMatch = url.pathname.match(/^\/app\/([^/]+)$/);
      if (appMatch) {
        const appId = decodeURIComponent(appMatch[1]);
        send(200, appRunnerHtml(appId), "text/html; charset=utf-8");
        return;
      }
      send(404, JSON.stringify({ error: "not_found" }));
    } catch (e) {
      send(500, JSON.stringify({ error: String(e) }));
    }
  });
  await listenOn(appsHost, hostPort).catch((e) => {
    console.warn("[monkey-mini-app] embedded host listen failed", e);
  });
  const addr = appsHost.address();
  const bound = typeof addr === "object" && addr ? addr.port : hostPort;
  boundHostPort = bound;
  disposers.push(() => {
    appsHost.close();
  });
  console.log(`[monkey-mini-app] apps host http://127.0.0.1:${bound}`);

  console.log(
    `[monkey-mini-app] loaded · runtimeRoot=${runtimeRoot} · tools=${tools.length} · skill=${getSkillDir()}`
  );

  // Reversible cleanup
  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    // service disposed with plugin fiber
  };
}

export default { name, inject, apply };
