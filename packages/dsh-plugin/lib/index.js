var hostBridge = null;
import { createRequire as __cr } from "module";
const __req = __cr(import.meta.url);
const git = __req("isomorphic-git");
const http = __req("http");
const { execFile } = __req("child_process");
const { promisify } = __req("util");
const execFileAsync = promisify(execFile);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/index.ts
import * as path7 from "path";
import * as os2 from "os";
import * as fs3 from "fs";

// ../runtime-core/src/index.ts
import * as path2 from "path";

// ../theme-light/src/index.ts
var src_exports = {};
__export(src_exports, {
  getTokens: () => getTokens,
  id: () => id,
  label: () => label
});
var id = "light";
var label = "Light";
function getTokens() {
  return {
    "color-background": "#ffffff",
    "color-foreground": "#0a0a0a",
    "color-primary": "#2563eb",
    "color-primary-foreground": "#ffffff",
    "color-muted": "#f4f4f5",
    "color-muted-foreground": "#71717a",
    "color-border": "#e4e4e7",
    "color-destructive": "#dc2626",
    "radius-sm": "4px",
    "radius-md": "8px",
    "radius-lg": "12px",
    "space-1": "4px",
    "space-2": "8px",
    "space-3": "12px",
    "space-4": "16px",
    "font-sans": "ui-sans-serif, system-ui, sans-serif",
    "font-mono": "ui-monospace, monospace"
  };
}

// ../theme-dark/src/index.ts
var src_exports2 = {};
__export(src_exports2, {
  getTokens: () => getTokens2,
  id: () => id2,
  label: () => label2
});
var id2 = "dark";
var label2 = "Dark";
function getTokens2() {
  return {
    "color-background": "#0a0a0a",
    "color-foreground": "#fafafa",
    "color-primary": "#3b82f6",
    "color-primary-foreground": "#ffffff",
    "color-muted": "#27272a",
    "color-muted-foreground": "#a1a1aa",
    "color-border": "#3f3f46",
    "color-destructive": "#ef4444",
    "radius-sm": "4px",
    "radius-md": "8px",
    "radius-lg": "12px",
    "space-1": "4px",
    "space-2": "8px",
    "space-3": "12px",
    "space-4": "16px",
    "font-sans": "ui-sans-serif, system-ui, sans-serif",
    "font-mono": "ui-monospace, monospace"
  };
}

// ../host-port/src/index.ts
function parseManifest(raw) {
  const m = JSON.parse(raw);
  if (!m.id || !m.name || !m.version || !m.entry) {
    throw new Error("INVALID_MANIFEST");
  }
  if (!Array.isArray(m.permissions)) {
    m.permissions = [];
  }
  return m;
}

// ../runtime-core/src/storage.ts
import * as path from "path";
function safeStoreFile(appId, storageDir, file) {
  let name2 = file?.trim() || "default.json";
  if (!name2.endsWith(".json")) name2 = `${name2}.json`;
  if (name2.includes("..") || name2.includes("/") || name2.includes("\\") || name2 === ".json") {
    throw Object.assign(new Error("INVALID_PAYLOAD"), {
      code: "INVALID_PAYLOAD"
    });
  }
  return path.join("apps", appId, storageDir, name2);
}
async function readJsonObject(host, relPath) {
  if (!await host.exists(relPath)) return {};
  const raw = await host.readFile(relPath);
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Object.assign(new Error("INVALID_STORAGE_JSON"), {
      code: "INTERNAL"
    });
  }
  return parsed;
}
async function writeJsonObject(host, relPath, obj) {
  const body = JSON.stringify(obj, null, 2);
  await host.writeFile(relPath, body);
}
var queues = /* @__PURE__ */ new Map();
function enqueue(key, fn) {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    key,
    next.then(
      () => void 0,
      () => void 0
    )
  );
  return next;
}
function createStorageHandlers(host, config) {
  return {
    async get(appId, payload) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        const value = Object.prototype.hasOwnProperty.call(obj, payload.key) ? obj[payload.key] : null;
        return { value };
      });
    },
    async set(appId, payload) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        obj[payload.key] = payload.value;
        await writeJsonObject(host, rel, obj);
        return { ok: true };
      });
    },
    async delete(appId, payload) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        delete obj[payload.key];
        await writeJsonObject(host, rel, obj);
        return { ok: true };
      });
    },
    async keys(appId, payload) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        return { keys: Object.keys(obj) };
      });
    },
    async clear(appId, payload) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        await writeJsonObject(host, rel, {});
        return { ok: true };
      });
    },
    async listFiles(appId) {
      const dir = path.join("apps", appId, config.directory);
      const names = await host.listDir(dir);
      return {
        files: names.filter((n) => n.endsWith(".json"))
      };
    }
  };
}

// ../bridge-protocol/src/index.ts
var BRIDGE_PROTOCOL_VERSION = 1;
function encodeMessage(msg) {
  return JSON.stringify(msg);
}
function decodeMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("INVALID_MESSAGE");
  }
  const m = parsed;
  if (m.v !== BRIDGE_PROTOCOL_VERSION) {
    throw new Error("UNSUPPORTED_VERSION");
  }
  if (m.type !== "bridge.call" && m.type !== "bridge.result" && m.type !== "host.event") {
    throw new Error("UNKNOWN_TYPE");
  }
  return parsed;
}
function createCall(id3, api, payload) {
  return {
    v: BRIDGE_PROTOCOL_VERSION,
    type: "bridge.call",
    id: id3,
    api,
    payload
  };
}
function createResult(id3, ok, result, error) {
  return {
    v: BRIDGE_PROTOCOL_VERSION,
    type: "bridge.result",
    id: id3,
    ok,
    ...ok ? { result } : { error }
  };
}
function permissionForApi(api) {
  if (api.startsWith("storage.")) return "storage";
  if (api === "theme.get") return null;
  if (api.startsWith("ui.")) return "ui";
  if (api.startsWith("host.")) {
    const name2 = api.slice("host.".length);
    return `host:${name2}`;
  }
  return api;
}

// ../runtime-core/src/bridge-hub.ts
function attachBridgeHub(appId, transport, opts) {
  return transport.onMessage(async (raw) => {
    let msg;
    try {
      msg = decodeMessage(raw);
    } catch {
      return;
    }
    if (msg.type !== "bridge.call") return;
    const call = msg;
    try {
      const result = await dispatch(appId, call.api, call.payload, opts);
      transport.send(encodeMessage(createResult(call.id, true, result)));
    } catch (e) {
      const err = e;
      const code = err.code === "PERMISSION_DENIED" || err.code === "NOT_FOUND" || err.code === "INVALID_PAYLOAD" || err.code === "HOST_ERROR" || err.code === "INTERNAL" ? err.code : "HOST_ERROR";
      transport.send(
        encodeMessage(
          createResult(call.id, false, void 0, {
            code,
            message: err.message ?? String(e)
          })
        )
      );
    }
  });
}
async function dispatch(appId, api, payload, opts) {
  const manifest = opts.getManifest(appId);
  if (!manifest) {
    throw Object.assign(new Error("app not found"), { code: "NOT_FOUND" });
  }
  const required = permissionForApi(api);
  if (required && !manifest.permissions.includes(required)) {
    throw Object.assign(new Error(`permission required: ${required}`), {
      code: "PERMISSION_DENIED"
    });
  }
  const p = payload ?? {};
  if (api === "storage.get") {
    return opts.storage.get(appId, {
      key: String(p.key),
      file: p.file
    });
  }
  if (api === "storage.set") {
    return opts.storage.set(appId, {
      key: String(p.key),
      value: p.value,
      file: p.file
    });
  }
  if (api === "storage.delete") {
    return opts.storage.delete(appId, {
      key: String(p.key),
      file: p.file
    });
  }
  if (api === "storage.keys") {
    return opts.storage.keys(appId, { file: p.file });
  }
  if (api === "storage.clear") {
    return opts.storage.clear(appId, { file: p.file });
  }
  if (api === "storage.listFiles") {
    return opts.storage.listFiles(appId);
  }
  if (api === "theme.get") {
    return { themeId: opts.getThemeId() };
  }
  if (api === "ui.toast") {
    opts.host.log?.("info", `toast:${appId}`, p);
    return { ok: true };
  }
  if (api.startsWith("host.")) {
    const name2 = api.slice("host.".length);
    try {
      return await opts.host.invoke(name2, p);
    } catch (e) {
      throw Object.assign(new Error(String(e)), { code: "HOST_ERROR" });
    }
  }
  throw Object.assign(new Error(`unknown api: ${api}`), { code: "NOT_FOUND" });
}

// ../api-client/src/index.ts
function createMiniClient(transport) {
  let seq = 0;
  const pending = /* @__PURE__ */ new Map();
  const eventHandlers = /* @__PURE__ */ new Map();
  const unsub = transport.onMessage((raw) => {
    let msg;
    try {
      msg = decodeMessage(raw);
    } catch {
      return;
    }
    if (msg.type === "bridge.result") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      const r = msg;
      if (r.ok) p.resolve(r.result);
      else
        p.reject(
          new Error(r.error?.message ?? r.error?.code ?? "BRIDGE_ERROR")
        );
    } else if (msg.type === "host.event") {
      const e = msg;
      const set = eventHandlers.get(e.event);
      if (set) for (const h of set) h(e.payload);
    }
  });
  void unsub;
  async function call(api, payload = {}) {
    const id3 = `c-${++seq}`;
    return new Promise((resolve2, reject) => {
      pending.set(id3, { resolve: resolve2, reject });
      transport.send(encodeMessage(createCall(id3, api, payload)));
    });
  }
  return {
    call,
    storage: {
      get: (key, opts) => call("storage.get", { key, file: opts?.file }),
      set: (key, value, opts) => call("storage.set", {
        key,
        value,
        file: opts?.file
      }),
      delete: (key, opts) => call("storage.delete", { key, file: opts?.file }),
      keys: (opts) => call("storage.keys", { file: opts?.file }),
      clear: (opts) => call("storage.clear", { file: opts?.file }),
      listFiles: () => call("storage.listFiles", {})
    },
    host: {
      invoke: (name2, payload = {}) => call(`host.${name2}`, payload)
    },
    on(event, handler) {
      let set = eventHandlers.get(event);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        eventHandlers.set(event, set);
      }
      set.add(handler);
      return () => set.delete(handler);
    }
  };
}
function createLoopbackPair() {
  const miniHandlers = [];
  const hostHandlers = [];
  const miniTransport = {
    send(message) {
      queueMicrotask(() => {
        for (const h of hostHandlers) h(message);
      });
    },
    onMessage(handler) {
      miniHandlers.push(handler);
      return () => {
        const i = miniHandlers.indexOf(handler);
        if (i >= 0) miniHandlers.splice(i, 1);
      };
    }
  };
  const hostTransport = {
    send(message) {
      queueMicrotask(() => {
        for (const h of miniHandlers) h(message);
      });
    },
    onMessage(handler) {
      hostHandlers.push(handler);
      return () => {
        const i = hostHandlers.indexOf(handler);
        if (i >= 0) hostHandlers.splice(i, 1);
      };
    }
  };
  return { miniTransport, hostTransport };
}

// ../runtime-core/src/index.ts
var DEFAULT_THEMES = {
  light: src_exports,
  dark: src_exports2
};
async function createRuntime(options) {
  const host = options.host;
  const appsRoot = options.appsRoot ?? "apps";
  const storageCfg = {
    directory: options.storage?.directory ?? "storage",
    defaultFile: options.storage?.defaultFile ?? "default.json"
  };
  const themes = options.themes ?? DEFAULT_THEMES;
  let themeId = options.themeId ?? "light";
  const history = options.history;
  const manifests = /* @__PURE__ */ new Map();
  const mounted = /* @__PURE__ */ new Set();
  const bridgeDisposers = /* @__PURE__ */ new Map();
  const tabs = /* @__PURE__ */ new Map();
  let activeTabId = null;
  let tabSeq = 0;
  const storage = createStorageHandlers(host, storageCfg);
  async function refreshRegistry() {
    manifests.clear();
    const names = await host.listDir(appsRoot);
    for (const name2 of names) {
      const manPath = path2.join(appsRoot, name2, "manifest.json");
      if (!await host.exists(manPath)) continue;
      try {
        const raw = await host.readFile(manPath);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        const m = parseManifest(text);
        if (m.id !== name2) {
          host.log?.(
            "warn",
            `manifest id ${m.id} !== dir ${name2}, using dir as id`
          );
        }
        manifests.set(name2, { ...m, id: name2 });
      } catch (e) {
        host.log?.("warn", `skip app ${name2}`, e);
      }
    }
  }
  await refreshRegistry();
  function getAppDir(appId) {
    return path2.join(host.getRuntimeRoot(), appsRoot, appId);
  }
  function applyThemeTokens() {
    const pack = themes[themeId] ?? themes.light;
    return pack.getTokens();
  }
  function listCapabilities() {
    return [
      {
        name: "storage.get",
        source: "runtime",
        permission: "storage",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            file: { type: "string" }
          },
          required: ["key"]
        }
      },
      {
        name: "storage.set",
        source: "runtime",
        permission: "storage",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: {},
            file: { type: "string" }
          },
          required: ["key", "value"]
        }
      },
      {
        name: "theme.get",
        source: "runtime",
        inputSchema: { type: "object" }
      },
      {
        name: "ui.toast",
        source: "runtime",
        permission: "ui",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } }
        }
      }
    ];
  }
  function openBridge(appId) {
    if (!manifests.has(appId)) {
      throw new Error(`unknown app: ${appId}`);
    }
    const { miniTransport, hostTransport } = createLoopbackPair();
    const disposeHub = attachBridgeHub(appId, hostTransport, {
      host,
      getManifest: (id3) => manifests.get(id3) ?? null,
      storage,
      getThemeId: () => themeId
    });
    const mini = createMiniClient(miniTransport);
    const dispose = () => {
      disposeHub();
    };
    return { mini, dispose };
  }
  const runtime = {
    getHost: () => host,
    getAppDir,
    applyThemeTokens,
    openBridge,
    async listApps() {
      await refreshRegistry();
      return [...manifests.values()].map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: true
      }));
    },
    async getApp(id3) {
      await refreshRegistry();
      const m = manifests.get(id3);
      if (!m) return null;
      return {
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: true,
        permissions: m.permissions
      };
    },
    async mount(id3, _target) {
      await refreshRegistry();
      if (!manifests.has(id3)) throw new Error(`unknown app: ${id3}`);
      mounted.add(id3);
    },
    async unmount(id3) {
      mounted.delete(id3);
      bridgeDisposers.get(id3)?.();
      bridgeDisposers.delete(id3);
    },
    async listThemes() {
      return Object.values(themes).map((t) => ({ id: t.id, label: t.label }));
    },
    async getTheme() {
      return themeId;
    },
    async setTheme(id3) {
      if (!themes[id3]) throw new Error(`unknown theme: ${id3}`);
      themeId = id3;
    },
    async registerAppFromFiles(appId, files) {
      if (appId.includes("..") || appId.includes("/") || appId.includes("\\")) {
        throw new Error("INVALID_APP_ID");
      }
      for (const [rel, content] of Object.entries(files)) {
        if (rel.includes("..")) throw new Error("PATH_ESCAPE");
        const dest = path2.join(appsRoot, appId, rel);
        await host.writeFile(dest, content);
      }
      await refreshRegistry();
      if (history) {
        const appDir = getAppDir(appId);
        await history.init(appDir);
        try {
          await history.commit(appDir, "registerAppFromFiles");
        } catch {
        }
      }
    },
    async removeApp(appId) {
      mounted.delete(appId);
      manifests.delete(appId);
      const marker = path2.join(appsRoot, appId, "manifest.json");
      if (await host.exists(marker)) {
        host.log?.("info", `removeApp: unregister ${appId}`);
      }
    },
    async listCapabilities() {
      return listCapabilities();
    },
    async historyCommit(appId, message) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.commit(getAppDir(appId), message);
    },
    async historyList(appId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.listCommits(getAppDir(appId), opts);
    },
    async historyRevert(appId, commitId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.revert(getAppDir(appId), commitId, opts);
    },
    async historyResetTo(appId, commitId, opts) {
      if (!history) throw new Error("HISTORY_NOT_CONFIGURED");
      await history.init(getAppDir(appId));
      return history.resetTo(getAppDir(appId), commitId, opts);
    },
    async openTab(appId, opts) {
      await refreshRegistry();
      if (!manifests.has(appId)) throw new Error(`unknown app: ${appId}`);
      const m = manifests.get(appId);
      tabSeq += 1;
      const tabId = `tab_${Date.now()}_${tabSeq}`;
      const tab = {
        tabId,
        appId,
        title: opts?.title ?? m.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      tabs.set(tabId, tab);
      activeTabId = tabId;
      mounted.add(appId);
      return tab;
    },
    async closeTab(tabId) {
      if (!tabs.has(tabId)) throw new Error(`unknown tab: ${tabId}`);
      const tab = tabs.get(tabId);
      tabs.delete(tabId);
      if (activeTabId === tabId) {
        const rest = [...tabs.keys()];
        activeTabId = rest.length ? rest[rest.length - 1] : null;
      }
      const still = [...tabs.values()].some((x) => x.appId === tab.appId);
      if (!still) {
        mounted.delete(tab.appId);
        bridgeDisposers.get(tab.appId)?.();
        bridgeDisposers.delete(tab.appId);
      }
    },
    async listTabs() {
      return [...tabs.values()];
    },
    async focusTab(tabId) {
      if (!tabs.has(tabId)) throw new Error(`unknown tab: ${tabId}`);
      activeTabId = tabId;
    },
    async getActiveTab() {
      if (!activeTabId) return null;
      return tabs.get(activeTabId) ?? null;
    }
  };
  return runtime;
}

// ../adapter-node/src/index.ts
import * as fs from "fs/promises";
import * as path3 from "path";
import * as os from "os";
function createNodeHostPort(options) {
  const root = path3.resolve(options.runtimeRoot);
  const handlers = options.hostHandlers ?? {};
  function resolve2(p) {
    if (path3.isAbsolute(p)) return p;
    return path3.join(root, p);
  }
  return {
    getRuntimeRoot() {
      return root;
    },
    async readFile(p) {
      const buf = await fs.readFile(resolve2(p));
      return buf;
    },
    async writeFile(p, data) {
      const abs = resolve2(p);
      await fs.mkdir(path3.dirname(abs), { recursive: true });
      await fs.writeFile(abs, data);
    },
    async listDir(p) {
      try {
        return await fs.readdir(resolve2(p));
      } catch {
        return [];
      }
    },
    async exists(p) {
      try {
        await fs.access(resolve2(p));
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(p, opts) {
      await fs.mkdir(resolve2(p), { recursive: opts?.recursive ?? true });
    },
    async invoke(name2, payload) {
      const h = handlers[name2];
      if (!h) throw new Error(`HOST_API_NOT_FOUND: ${name2}`);
      return await h(payload);
    },
    log(level, message, meta) {
      const line = meta ? `[${level}] ${message} ${JSON.stringify(meta)}` : `[${level}] ${message}`;
      console.log(line);
    }
  };
}

// ../app-history/src/index.ts
function createHistory(adapter) {
  return adapter;
}

// ../app-history-git/src/index.ts
import fs2 from "fs";
import fsp from "fs/promises";
import * as path4 from "path";

var DEFAULT_AUTHOR = {
  name: "mini-agent",
  email: "agent@local"
};
var GITIGNORE = `storage/
.DS_Store
node_modules/
`;
async function ensureGitignore(dir) {
  const p = path4.join(dir, ".gitignore");
  try {
    await fsp.access(p);
  } catch {
    await fsp.writeFile(p, GITIGNORE, "utf8");
  }
}
async function listBackupRefs(dir) {
  const refsDir = path4.join(dir, ".git", "refs", "backup");
  try {
    const names = await fsp.readdir(refsDir);
    const out = [];
    for (const name2 of names) {
      const oid = (await fsp.readFile(path4.join(refsDir, name2), "utf8")).trim();
      out.push({ name: `backup/${name2}`, oid });
    }
    return out;
  } catch {
    return [];
  }
}
function createGitHistoryAdapter() {
  return {
    async init(appDir) {
      await fsp.mkdir(appDir, { recursive: true });
      const gitdir = path4.join(appDir, ".git");
      try {
        await fsp.access(gitdir);
      } catch {
        await git.init({ fs: fs2, dir: appDir, defaultBranch: "main" });
      }
      await ensureGitignore(appDir);
      try {
        await git.resolveRef({ fs: fs2, dir: appDir, ref: "main" });
      } catch {
        await git.add({ fs: fs2, dir: appDir, filepath: ".gitignore" });
        await git.commit({
          fs: fs2,
          dir: appDir,
          message: "init",
          author: DEFAULT_AUTHOR
        });
      }
    },
    async commit(appDir, message, opts) {
      const status = await git.statusMatrix({ fs: fs2, dir: appDir });
      for (const [filepath, , workdirStatus, stageStatus] of status) {
        if (filepath === ".") continue;
        if (workdirStatus !== stageStatus || workdirStatus === 0) {
          try {
            if (workdirStatus === 0) {
              await git.remove({ fs: fs2, dir: appDir, filepath });
            } else {
              await git.add({ fs: fs2, dir: appDir, filepath });
            }
          } catch {
          }
        }
      }
      const commitId = await git.commit({
        fs: fs2,
        dir: appDir,
        message,
        author: opts?.author ?? DEFAULT_AUTHOR
      });
      return { commitId };
    },
    async listCommits(appDir, opts) {
      const limit = opts?.limit ?? 100;
      const nodesMap = /* @__PURE__ */ new Map();
      const tips = [];
      let head = "";
      try {
        head = await git.resolveRef({ fs: fs2, dir: appDir, ref: "HEAD" });
        tips.push({ name: "main", commitId: head });
      } catch {
        return { head: "", nodes: [], tips: [] };
      }
      async function walk(oid, remaining) {
        if (remaining <= 0 || nodesMap.has(oid)) return;
        const commit = await git.readCommit({ fs: fs2, dir: appDir, oid });
        const parentIds = commit.commit.parent ?? [];
        nodesMap.set(oid, {
          id: oid,
          parentIds,
          message: commit.commit.message.trim(),
          time: new Date(commit.commit.author.timestamp * 1e3).toISOString()
        });
        for (const p of parentIds) {
          await walk(p, remaining - 1);
        }
      }
      await walk(head, limit);
      const backups = await listBackupRefs(appDir);
      for (const b of backups) {
        tips.push({ name: b.name, commitId: b.oid });
        await walk(b.oid, limit);
      }
      return {
        head,
        nodes: [...nodesMap.values()],
        tips
      };
    },
    async revert(appDir, commitId, opts) {
      const head = await git.resolveRef({ fs: fs2, dir: appDir, ref: "HEAD" });
      const target = await git.readCommit({ fs: fs2, dir: appDir, oid: commitId });
      const parents = target.commit.parent;
      if (parents.length !== 1) {
        throw Object.assign(new Error("REVERT_CONFLICT"), {
          code: "REVERT_CONFLICT"
        });
      }
      const parentOid = parents[0];
      if (head === commitId) {
        await git.checkout({
          fs: fs2,
          dir: appDir,
          ref: parentOid,
          force: true
        });
        await git.branch({
          fs: fs2,
          dir: appDir,
          ref: "main",
          object: parentOid,
          force: true,
          checkout: true
        });
      }
      const targetTree = target.commit.tree;
      const parentCommit = await git.readCommit({
        fs: fs2,
        dir: appDir,
        oid: parentOid
      });
      const parentTree = parentCommit.commit.tree;
      async function treeFiles(treeOid, prefix = "") {
        const map = /* @__PURE__ */ new Map();
        const tree = await git.readTree({ fs: fs2, dir: appDir, oid: treeOid });
        for (const entry of tree.tree) {
          const fp = prefix ? `${prefix}/${entry.path}` : entry.path;
          if (entry.type === "blob") {
            map.set(fp, entry.oid);
          } else if (entry.type === "tree") {
            const sub = await treeFiles(entry.oid, fp);
            for (const [k, v] of sub) map.set(k, v);
          }
        }
        return map;
      }
      const before = await treeFiles(parentTree);
      const after = await treeFiles(targetTree);
      const allPaths = /* @__PURE__ */ new Set([...before.keys(), ...after.keys()]);
      for (const fp of allPaths) {
        const b = before.get(fp);
        const a = after.get(fp);
        if (b === a) continue;
        const abs = path4.join(appDir, fp);
        if (!b) {
          try {
            await fsp.unlink(abs);
          } catch {
          }
          try {
            await git.remove({ fs: fs2, dir: appDir, filepath: fp });
          } catch {
          }
        } else {
          const { blob } = await git.readBlob({
            fs: fs2,
            dir: appDir,
            oid: b
          });
          await fsp.mkdir(path4.dirname(abs), { recursive: true });
          await fsp.writeFile(abs, Buffer.from(blob));
          await git.add({ fs: fs2, dir: appDir, filepath: fp });
        }
      }
      try {
        await git.checkout({ fs: fs2, dir: appDir, ref: "main", force: true });
      } catch {
      }
      for (const fp of allPaths) {
        const b = before.get(fp);
        const a = after.get(fp);
        if (b === a) continue;
        const abs = path4.join(appDir, fp);
        if (!b) {
          try {
            await fsp.unlink(abs);
          } catch {
          }
          try {
            await git.remove({ fs: fs2, dir: appDir, filepath: fp });
          } catch {
          }
        } else {
          const { blob } = await git.readBlob({ fs: fs2, dir: appDir, oid: b });
          await fsp.mkdir(path4.dirname(abs), { recursive: true });
          await fsp.writeFile(abs, Buffer.from(blob));
          await git.add({ fs: fs2, dir: appDir, filepath: fp });
        }
      }
      const newId = await git.commit({
        fs: fs2,
        dir: appDir,
        message: opts?.message ?? `revert: ${commitId.slice(0, 7)}`,
        author: DEFAULT_AUTHOR
      });
      return { commitId: newId };
    },
    async resetTo(appDir, commitId, opts) {
      const createBackup = opts?.createBackupRef !== false;
      let backupRef;
      if (createBackup) {
        try {
          const head = await git.resolveRef({ fs: fs2, dir: appDir, ref: "HEAD" });
          const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
          const ref = `refs/backup/${stamp}`;
          await git.writeRef({ fs: fs2, dir: appDir, ref, value: head });
          backupRef = `backup/${stamp}`;
        } catch {
        }
      }
      await git.branch({
        fs: fs2,
        dir: appDir,
        ref: "main",
        object: commitId,
        force: true,
        checkout: true
      });
      return { backupRef };
    }
  };
}

// ../agent-core/src/index.ts
import * as path5 from "path";
var APP_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
function listAgentTools() {
  return [
    {
      name: "mini_app_list",
      description: "List registered monkey-mini-app applications",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "mini_app_get",
      description: "Get app manifest summary and absolute directory path",
      inputSchema: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"]
      }
    },
    {
      name: "mini_app_validate",
      description: "Validate app id format and that app is registered (or path ready)",
      inputSchema: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"]
      }
    },
    {
      name: "mini_app_register",
      description: "Register app from in-memory file map (manifest + sources). Prefer writing files via host fs tools then register.",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          files: { type: "object", additionalProperties: { type: "string" } }
        },
        required: ["appId", "files"]
      }
    },
    {
      name: "mini_app_open",
      description: "Open app in a new host tab (multi-tab; does not close others)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          title: { type: "string" }
        },
        required: ["appId"]
      }
    },
    {
      name: "mini_app_close_tab",
      description: "Close a host tab by tabId",
      inputSchema: {
        type: "object",
        properties: { tabId: { type: "string" } },
        required: ["tabId"]
      }
    },
    {
      name: "mini_app_list_tabs",
      description: "List open host tabs",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "mini_app_focus",
      description: "Focus an open tab",
      inputSchema: {
        type: "object",
        properties: { tabId: { type: "string" } },
        required: ["tabId"]
      }
    },
    {
      name: "mini_app_history_commit",
      description: "Commit current app working tree (single-branch main)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          message: { type: "string" }
        },
        required: ["appId", "message"]
      }
    },
    {
      name: "mini_app_history_list",
      description: "List commit tree (nodes + parentIds, includes backup tips after reset)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["appId"]
      }
    },
    {
      name: "mini_app_history_reset",
      description: "Reset main to commitId; creates backup ref; does not delete commits",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          commitId: { type: "string" }
        },
        required: ["appId", "commitId"]
      }
    },
    {
      name: "mini_app_history_revert",
      description: "Forward-commit that undoes a past commit (git revert semantics)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          commitId: { type: "string" }
        },
        required: ["appId", "commitId"]
      }
    },
    {
      name: "mini_app_set_theme",
      description: "Set host theme id (e.g. light|dark)",
      inputSchema: {
        type: "object",
        properties: { themeId: { type: "string" } },
        required: ["themeId"]
      }
    }
  ];
}
function createAgentHandlers(ctx) {
  const { runtime, resolveAppDir, runtimeRoot } = ctx;
  return {
    async mini_app_list() {
      const apps = await runtime.listApps();
      return { apps, runtimeRoot };
    },
    async mini_app_get({ appId }) {
      const app = await runtime.getApp(appId);
      if (!app) return { ok: false, error: "NOT_FOUND" };
      return {
        ok: true,
        app,
        path: resolveAppDir(appId)
      };
    },
    async mini_app_validate({ appId }) {
      const errors = [];
      if (!APP_ID_RE.test(appId)) {
        errors.push("appId must be reverse-DNS (e.g. com.example.todo)");
      }
      const app = await runtime.getApp(appId);
      if (!app) errors.push("app not registered; write files then mini_app_register");
      return { ok: errors.length === 0, errors, path: resolveAppDir(appId) };
    },
    async mini_app_register({ appId, files }) {
      if (!APP_ID_RE.test(appId)) throw new Error("INVALID_APP_ID");
      if (!files["manifest.json"]) throw new Error("MISSING_MANIFEST");
      await runtime.registerAppFromFiles(appId, files);
      return {
        ok: true,
        path: resolveAppDir(appId),
        app: await runtime.getApp(appId)
      };
    },
    async mini_app_open({ appId, title }) {
      return runtime.openTab(appId, { title });
    },
    async mini_app_close_tab({ tabId }) {
      await runtime.closeTab(tabId);
      return { ok: true };
    },
    async mini_app_list_tabs() {
      return runtime.listTabs();
    },
    async mini_app_focus({ tabId }) {
      await runtime.focusTab(tabId);
      return { ok: true, active: await runtime.getActiveTab() };
    },
    async mini_app_history_commit({ appId, message }) {
      return runtime.historyCommit(appId, message);
    },
    async mini_app_history_list({ appId, limit }) {
      return runtime.historyList(appId, { limit });
    },
    async mini_app_history_reset({ appId, commitId }) {
      return runtime.historyResetTo(appId, commitId);
    },
    async mini_app_history_revert({ appId, commitId }) {
      return runtime.historyRevert(appId, commitId);
    },
    async mini_app_set_theme({ themeId }) {
      await runtime.setTheme(themeId);
      return { ok: true, themeId: await runtime.getTheme() };
    }
  };
}
async function invokeAgentTool(handlers, name2, input = {}) {
  const map = handlers;
  const fn = map[name2];
  if (!fn) throw new Error(`UNKNOWN_TOOL: ${name2}`);
  return fn(input);
}
function defaultResolveAppDir(runtimeRoot, appId) {
  return path5.join(runtimeRoot, "apps", appId);
}

// ../ui-core/src/index.ts
function createUiCore(runtime) {
  let state = {
    tabs: [],
    activeTabId: null,
    themeId: "light",
    apps: []
  };
  const listeners = /* @__PURE__ */ new Set();
  function emit() {
    for (const fn of listeners) fn(state);
  }
  async function syncFromRuntime() {
    const [tabs, active, themeId, apps] = await Promise.all([
      runtime.listTabs(),
      runtime.getActiveTab(),
      runtime.getTheme(),
      runtime.listApps()
    ]);
    state = {
      tabs,
      activeTabId: active?.tabId ?? null,
      themeId,
      apps: apps.map((a) => ({ id: a.id, name: a.name, version: a.version }))
    };
    emit();
  }
  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh: syncFromRuntime,
    async openTab(appId, title) {
      const tab = await runtime.openTab(appId, { title });
      await syncFromRuntime();
      return tab;
    },
    async closeTab(tabId) {
      await runtime.closeTab(tabId);
      await syncFromRuntime();
    },
    async focusTab(tabId) {
      await runtime.focusTab(tabId);
      await syncFromRuntime();
    },
    async setTheme(themeId) {
      await runtime.setTheme(themeId);
      await syncFromRuntime();
    }
  };
}

// ../agent-skills/src/index.ts
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import * as path6 from "path";
function resolveSkillDir() {
  const here = path6.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // agent-skills package layout: dist/ or src/ → ../skills
    path6.join(here, "..", "skills", "monkey-mini-app"),
    // bundled into dsh-plugin/lib → ../skills
    path6.join(here, "..", "skills", "monkey-mini-app"),
    // monorepo sibling from dsh-plugin/lib
    path6.join(here, "..", "..", "agent-skills", "skills", "monkey-mini-app")
  ];
  for (const c of candidates) {
    if (existsSync(path6.join(c, "SKILL.md"))) return c;
  }
  return candidates[0];
}
function getSkillDir() {
  return resolveSkillDir();
}
function getSkillMarkdown() {
  return readFileSync(path6.join(resolveSkillDir(), "SKILL.md"), "utf8");
}

// src/index.ts
var name = "monkey-mini-app";
var inject = ["tools"];
function expandHome(p) {
  if (p.startsWith("~/")) return path7.join(os2.homedir(), p.slice(2));
  return p;
}
function resolveRuntimeRoot(cfg) {
  if (cfg.runtimeRoot) return expandHome(cfg.runtimeRoot);
  if (process.env.MONKEY_MINI_APP_ROOT) {
    return expandHome(process.env.MONKEY_MINI_APP_ROOT);
  }
  return path7.join(os2.homedir(), ".monkey-mini-app", "runtime");
}
async function apply(ctx, config = {}) {
  const runtimeRoot = resolveRuntimeRoot(config);
  hostBridge = createHostBridge(ctx);
  console.log("[monkey-mini-app] host bridge ready (bash/tool/mcp/llm/agent)");
  const themeId = config.themeId ?? "light";
  const host = createNodeHostPort({ runtimeRoot });
  const history = createHistory(createGitHistoryAdapter());
  const runtime = await createRuntime({ host, history, themeId });
  const handlers = createAgentHandlers({
    runtime,
    runtimeRoot,
    resolveAppDir: (id3) => defaultResolveAppDir(runtimeRoot, id3)
  });
  const ui = createUiCore(runtime);
  await ui.refresh();
  const service = {
    runtime,
    ui,
    handlers,
    runtimeRoot,
    skillDir: getSkillDir(),
    skillMarkdown: getSkillMarkdown()
  };
  if (typeof ctx.provide === "function") {
    ctx.provide("monkeyMiniApp", service);
  }
  const disposers = [];
  const tools = listAgentTools();
  let defineTool = null;
  try {
    const mod = await import(
      /* @vite-ignore */
      "@deepseek-ai/dsh-tools"
    );
    defineTool = mod.defineTool ?? null;
  } catch {
    defineTool = null;
  }
  if (ctx.tools?.register) {
    for (const toolDef of tools) {
      const props = toolDef.inputSchema?.properties ?? {};
      const required = new Set(
        toolDef.inputSchema?.required ?? []
      );
      const parameters = {};
      for (const [key, schema] of Object.entries(props)) {
        parameters[key] = {
          type: schema.type ?? "string",
          required: required.has(key),
          description: schema.description ?? key
        };
      }
      const toolName = toolDef.name;
      const built = defineTool ? defineTool({
        name: toolName,
        description: toolDef.description,
        parameters,
        output: {
          schema: { type: "object", additionalProperties: true },
          render: (_args, value) => [
            {
              type: "text",
              text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
            }
          ]
        },
        async execute(args) {
          return invokeAgentTool(handlers, toolName, args ?? {});
        }
      }) : {
        name: toolName,
        description: toolDef.description,
        parameters,
        output: {
          schema: { type: "object", additionalProperties: true },
          render: (_args, value) => [
            {
              type: "text",
              text: JSON.stringify(value, null, 2)
            }
          ]
        },
        async execute(args) {
          return invokeAgentTool(handlers, toolName, args ?? {});
        }
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
  } else {
    console.warn(
      "[monkey-mini-app] ctx.tools missing; inject=['tools'] required for model-facing tools"
    );
  }
  try {
    const skillSrc = getSkillDir();
    const skillDst = path7.join(os2.homedir(), ".dsh", "skills", "monkey-mini-app");
    fs3.mkdirSync(path7.dirname(skillDst), { recursive: true });
    fs3.cpSync(skillSrc, skillDst, { recursive: true });
  } catch (e) {
    console.warn("[monkey-mini-app] skill install skipped:", e);
  }

  const handleApps = async () => {
    try {
      return await handlers.mini_app_list({});
    } catch (e) {
      return { apps: [], error: String(e) };
    }
  };
  const sendJson = (res, data) => {
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
      try { res.setHeader?.("Content-Type", "application/json; charset=utf-8"); } catch {}
      res.end(body);
      return;
    }
    return body;
  };
  const appsHandler = async (req, res) => {
    const data = await handleApps();
    return sendJson(res, data);
  };
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["webServer"], (scope) => {
        const ws = scope.webServer;
        if (!ws || typeof ws.register !== "function") {
          console.warn("[monkey-mini-app] webServer.register missing");
          return;
        }
        // dsh webServer: register({ kind, path, handler })
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
              handler: async (req, res) => {
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
            // last resort: string form used by some forks
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

  const hostPort = Number(process.env.MONKEY_MINI_APP_HOST_PORT || 17880);

  function defineDashboard(def) {
  if (!def?.name || !def?.description) throw new Error("defineDashboard requires name and description");
  if (!def.api || typeof def.api !== "object") throw new Error("defineDashboard.api must be an object");
  return def;
}

function makeFileStorage(appDir, fileName) {
  const fp = path7.join(appDir, "storage", fileName);
  const read = () => {
    try {
      return JSON.parse(fs3.readFileSync(fp, "utf8"));
    } catch {
      return {};
    }
  };
  const write = (obj) => {
    fs3.mkdirSync(path7.dirname(fp), { recursive: true });
    fs3.writeFileSync(fp, JSON.stringify(obj, null, 2));
  };
  return {
    async get(key) {
      const obj = read();
      return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
    },
    async set(key, value) {
      const obj = read();
      obj[key] = value;
      write(obj);
    },
    async delete(key) {
      const obj = read();
      delete obj[key];
      write(obj);
    },
    async clear() {
      write({});
    },
    table(name) {
      const safe = String(name).replace(/[^A-Za-z0-9_-]/g, "_");
      return makeFileStorage(appDir, `${safe}.storage.json`);
    },
  };
}

function resolveAppModule(fromFile, spec, appDir) {
  const root = path7.resolve(appDir);
  const base = spec.startsWith(".") ? path7.resolve(path7.dirname(fromFile), spec) : path7.resolve(root, spec);
  const resolved = path7.resolve(base);
  if (resolved !== root && !resolved.startsWith(root + path7.sep)) {
    throw new Error("backend import escapes app dir: " + spec);
  }
  const candidates = [resolved, resolved + ".ts", resolved + ".js", resolved + ".tsx", path7.join(resolved, "index.ts"), path7.join(resolved, "index.js"), path7.join(resolved, "index.tsx")];
  for (const c of candidates) {
    if (fs3.existsSync(c) && fs3.statSync(c).isFile()) return c;
  }
  throw new Error("cannot resolve '" + spec + "' from " + path7.relative(appDir, fromFile));
}

function compileAppSource(src) {
  let out = String(src || "").replace(/^\uFEFF/, "");
  try {
    const mod = require("node:module");
    if (mod && typeof mod.stripTypeScriptTypes === "function") {
      out = mod.stripTypeScriptTypes(out);
    }
  } catch {
    out = out.replace(/^\s*import\s+type\s+[^;]+;?\s*$/gm, "");
    out = out.replace(/^\s*export\s+type\s+[^;]+;?\s*$/gm, "");
    out = out.replace(/^\s*export\s+interface\s+[\s\S]*?\n\}\s*$/gm, "");
    out = out.replace(/^\s*interface\s+[\s\S]*?\n\}\s*$/gm, "");
  }
  out = out.replace(/import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (_m, def, named, spec) => `const ${def} = require(${JSON.stringify(spec)}); const {${named}} = ${def};`);
  out = out.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (_m, named, spec) => `const {${named}} = require(${JSON.stringify(spec)});`);
  out = out.replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_m, name, spec) => `const ${name} = require(${JSON.stringify(spec)});`);
  out = out.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_m, name, spec) => `const ${name} = require(${JSON.stringify(spec)});`);
  out = out.replace(/export\s+default\s+/, "module.exports.default = ");
  out = out.replace(/export\s+async\s+function\s+/g, "async function ");
  out = out.replace(/export\s+\{([^}]+)\}\s*;?/g, (_m, names) => names.split(",").map((part) => {
    const bits = part.trim().split(/\s+as\s+/);
    const local = bits[0].trim();
    const exp = (bits[1] || bits[0]).trim();
    return `module.exports[${JSON.stringify(exp)}] = ${local};`;
  }).join("\n"));
  out = out.replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ");
  return out;
}

const loadedAppModules = new Map();

function loadAppFile(file, appDir) {
  const key = file;
  if (loadedAppModules.has(key)) return loadedAppModules.get(key);
  const mod = { exports: {} };
  loadedAppModules.set(key, mod.exports);
  const src = compileAppSource(fs3.readFileSync(file, "utf8"));
  const req = (spec) => {
    if (spec === "@monkeyagent/dashboard") return { defineDashboard, default: defineDashboard };
    if (spec.startsWith(".") || spec.startsWith("lib/") || spec.startsWith("components/")) {
      return loadAppFile(resolveAppModule(file, spec, appDir), appDir);
    }
    throw new Error("backend cannot import '" + spec + "'. Only @monkeyagent/dashboard and relative ./lib ./components");
  };
  const fn = new Function("module", "exports", "require", src + "\nreturn module.exports;");
  const exported = fn(mod, mod.exports, req);
  const value = exported || mod.exports;
  loadedAppModules.set(key, value);
  return value;
}

function loadMainApi(appDir) {
  loadedAppModules.clear();
  const fp = path7.join(appDir, "main.api.ts");
  const fpJs = path7.join(appDir, "main.api.js");
  const srcPath = fs3.existsSync(fp) ? fp : fpJs;
  if (!fs3.existsSync(srcPath)) throw new Error("missing main.api.ts");
  const exported = loadAppFile(srcPath, appDir);
  return (exported && (exported.default || exported)) || exported;
}

const dashboardCache = new Map();

/** Bound in apply() to the live Cordis/dsh context so RunContext can reuse host seams. */

function stringifyToolResult(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function llmViaOpenAICompat(prompt, opts) {
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
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
  };
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
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`llm http ${res.status}: ${stringifyToolResult(j)}`);
  }
  const text = j?.choices?.[0]?.message?.content;
  if (text == null) throw new Error("llm empty response: " + stringifyToolResult(j));
  return String(text);
}


function readMiniLlmConfig() {
  try {
    const root = process.env.MONKEY_MINI_APP_ROOT || (require("node:os").homedir() + "/.monkey-mini-app/runtime");
    const fp = require("node:path").join(String(root).replace(/^~/, require("node:os").homedir()), "llm.json");
    if (require("fs").existsSync(fp)) {
      return JSON.parse(require("fs").readFileSync(fp, "utf8") || "{}");
    }
  } catch {}
  return {};
}

function resolveLlmRoute(get, opts) {
  const file = readMiniLlmConfig();
  const settings = (() => {
    try {
      const s = typeof get === "function" ? get("settings") || get("config") : null;
      if (s && typeof s.getAll === "function") return s.getAll() || {};
      if (s && typeof s.snapshot === "function") return s.snapshot() || {};
      return s && typeof s === "object" ? s : {};
    } catch { return {}; }
  })();
  const provider =
    (opts && typeof opts.provider === "string" && opts.provider) ||
    file.provider ||
    settings.provider ||
    (settings.llm && settings.llm.provider) ||
    process.env.MONKEY_MINI_APP_LLM_PROVIDER ||
    "deepseek-official";
  const model =
    (opts && typeof opts.model === "string" && opts.model) ||
    file.model ||
    settings.model ||
    (settings.llm && settings.llm.model) ||
    process.env.MONKEY_MINI_APP_LLM_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    "deepseek-v4-flash";
  return { provider, model };
}

async function collectLlmStream(llmSvc, prompt, route, opts) {
  const messages = [
    {
      role: "user",
      content: [{ type: "text", text: String(prompt) }],
    },
  ];
  const req = {
    provider: route.provider,
    model: route.model,
    messages,
    system: (opts && opts.system) || undefined,
    maxTokens: (opts && opts.maxTokens) || 1024,
  };
  const acc = [];
  const iter = llmSvc.stream(req);
  for await (const chunk of iter) {
    if (!chunk) continue;
    if (chunk.type === "text-delta" && chunk.text) acc.push(chunk.text);
    else if (chunk.type === "block-end" && chunk.block && chunk.block.type === "text" && chunk.block.text) acc.push(chunk.block.text);
    else if (typeof chunk.text === "string") acc.push(chunk.text);
    else if (typeof chunk === "string") acc.push(chunk);
  }
  const text = acc.join("");
  if (!text) throw new Error("llm stream empty");
  return text;
}

function createHostBridge(cordisCtx) {
  const get = (name) => {
    try {
      if (typeof cordisCtx.get === "function") return cordisCtx.get(name);
    } catch {
      /* ignore */
    }
    return (cordisCtx )[name];
  };

  const bash = async (command) => {
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
    } catch (e) {
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
        const r = await shell.run({ command, description: "mini-app bash" });
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

  const findTool = (name) => {
    const tools = get("tools") || cordisCtx.tools;
    if (!tools) return null;
    const candidates = [
      name,
      name.startsWith("mcp__") ? name : null,
      `mcp__${name}`,
    ].filter(Boolean) ;
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
        const hit = list.find((x) => x?.name === n || x?.name?.endsWith(`__${name}`));
        if (hit) return { tools, tool: hit, name: hit.name || n };
      }
      // bare MCP name match suffix
      const hit = list.find(
        (x) => typeof x?.name === "string" && x.name.endsWith(`__${name}`)
      );
      if (hit) return { tools, tool: hit, name: hit.name };
    }
    return { tools, tool: null, name };
  };

  const tool = async (name, args = {}) => {
    const found = findTool(name);
    if (!found?.tools) throw new Error("tool: ctx.tools not available");
    const { tools, tool: t, name: resolved } = found;
    const payload = args && typeof args === "object" ? args : {};
    // Never wrap as { input: "..." }
    if (typeof tools.execute === "function") {
      return stringifyToolResult(await tools.execute(resolved || name, payload));
    }
    if (typeof tools.invoke === "function") {
      return stringifyToolResult(await tools.invoke(resolved || name, payload));
    }
    if (typeof tools.call === "function") {
      return stringifyToolResult(await tools.call(resolved || name, payload));
    }
    if (t && typeof t.execute === "function") {
      return stringifyToolResult(await t.execute(payload, { signal: AbortSignal.timeout(120_000) }));
    }
    if (t && typeof t.run === "function") {
      return stringifyToolResult(await t.run(payload));
    }
    throw new Error(
      `tool '${name}' not invokable (resolved=${resolved}); dsh tools registry API not matched`
    );
  };

  const mcp = async (name, args) => {
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

  const llm = async (prompt, opts) => {
    const llmSvc = get("llm") || get("model") || get("chat");
    const route = resolveLlmRoute(get, opts);
    if (llmSvc && typeof llmSvc.stream === "function") {
      try {
        return await collectLlmStream(llmSvc, prompt, route, opts);
      } catch (e) {
        console.warn("[mini-api] ctx.llm.stream failed", e && e.message ? e.message : e);
      }
    }
    if (llmSvc) {
      if (typeof llmSvc.complete === "function") {
        return stringifyToolResult(await llmSvc.complete(prompt, { ...opts, ...route }));
      }
      if (typeof llmSvc.chat === "function") {
        return stringifyToolResult(
          await llmSvc.chat([{ role: "user", content: prompt }], { ...opts, ...route })
        );
      }
      if (typeof llmSvc.generate === "function") {
        return stringifyToolResult(await llmSvc.generate(prompt, { ...opts, ...route }));
      }
      if (typeof llmSvc === "function") {
        return stringifyToolResult(await llmSvc(prompt, { ...opts, ...route }));
      }
    }
    return llmViaOpenAICompat(prompt, { ...opts, ...route });
  };

  const agent = async (goal, opts) => {
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

  const config = () => {
    const settings = get("settings") || get("config");
    const snap =
      (settings && typeof settings.getAll === "function" && settings.getAll()) ||
      (settings && typeof settings.snapshot === "function" && settings.snapshot()) ||
      settings ||
      {};
    return {
      theme: "light",
      chatLanguage: "zh",
      ...(typeof snap === "object" && snap ? snap : {}),
    };
  };

  const credentials = () => {
    const cred = get("credentials");
    if (!cred) return {};
    if (typeof cred.getAll === "function") return cred.getAll() || {};
    if (typeof cred === "object") return { ...(cred ) };
    return {};
  };

  return { bash, tool, mcp, llm, agent, config, credentials };
}

function getDashboard(appDir) {
  const fp = path7.join(appDir, "main.api.ts");
  const mtime = fs3.existsSync(fp) ? fs3.statSync(fp).mtimeMs : 0;
  const hit = dashboardCache.get(appDir);
  if (hit && hit.mtime === mtime) return hit;
  const def = loadMainApi(appDir);
  const storage = makeFileStorage(appDir, "main.storage.json");
  const bridge = hostBridge;
  const ctx = {
    storage,
    state: def.state || {},
    config: bridge ? bridge.config() : { theme: "light", chatLanguage: "zh" },
    credentials: bridge ? bridge.credentials() : {},
    log: (...a) => console.log("[mini-api]", ...a),
    push: (_method, _params) => {
      /* UI event bus extension; host UI may subscribe later */
    },
    mcp: async (name, args) => {
      if (!bridge) throw new Error("mcp: host bridge not ready");
      return bridge.mcp(name, args);
    },
    tool: async (name, args) => {
      if (!bridge) throw new Error("tool: host bridge not ready");
      return bridge.tool(name, args);
    },
    llm: async (prompt, opts) => {
      if (!bridge) throw new Error("llm: host bridge not ready");
      return bridge.llm(prompt, opts);
    },
    agent: async (goal, opts) => {
      if (!bridge) throw new Error("agent: host bridge not ready");
      return bridge.agent(goal, opts);
    },
    bash: async (command) => {
      if (!bridge) throw new Error("bash: host bridge not ready");
      return bridge.bash(command);
    },
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
  const rec = { mtime, def, ctx };
  dashboardCache.set(appDir, rec);
  return rec;
}

async function callMainApi(appDir, method, args) {
  const { def, ctx } = getDashboard(appDir);
  const fn = def.api?.[method];
  if (typeof fn !== "function") throw new Error("Method not found: " + method);
  return await fn(ctx, args ?? {});
}

function appRunnerHtml(appId) {
  const safe = JSON.stringify(appId);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${appId}</title>
<style>
  :root {
    --background:#f7f7f8; --foreground:#111;
    --card:#fff; --card-foreground:#111;
    --primary:#2563eb; --primary-foreground:#fff;
    --secondary:#f3f4f6; --secondary-foreground:#111;
    --muted:#f3f4f6; --muted-foreground:#6b7280;
    --accent:#f3f4f6; --accent-foreground:#111;
    --destructive:#dc2626; --destructive-foreground:#fff;
    --border:#e5e7eb; --input:#e5e7eb; --ring:#2563eb;
    --radius:10px;
    --color-background:var(--background); --color-surface:var(--card); --color-foreground:var(--foreground);
    --color-primary:var(--primary); --color-primary-foreground:var(--primary-foreground);
    --color-muted:var(--muted); --color-muted-foreground:var(--muted-foreground); --color-border:var(--border);
    --radius-md:var(--radius); --space-4:16px;
    --font-sans:ui-sans-serif,system-ui,-apple-system,sans-serif;
  }
  html,body,#root{margin:0;height:100%;background:var(--background);color:var(--foreground);font-family:var(--font-sans);}
  html[data-theme="dark"] {
    --background:#0b0b0c; --foreground:#f4f4f5;
    --card:#171717; --card-foreground:#f4f4f5;
    --primary:#3b82f6; --primary-foreground:#fff;
    --secondary:#27272a; --secondary-foreground:#f4f4f5;
    --muted:#27272a; --muted-foreground:#a1a1aa;
    --accent:#27272a; --accent-foreground:#f4f4f5;
    --destructive:#ef4444; --destructive-foreground:#fff;
    --border:#2a2a2c; --input:#2a2a2c; --ring:#3b82f6;
  }
  .err{padding:24px;color:#b91c1c;white-space:pre-wrap;}
  @keyframes mma-pulse{0%,100%{opacity:1}50%{opacity:.45}}
  @keyframes mma-spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="root">loading…</div>
<script type="module">
const APP_ID = ${safe};
(() => {
  const th = new URLSearchParams(location.search).get("theme") || "light";
  document.documentElement.setAttribute("data-theme", th);
})();
const React = await import("https://esm.sh/react@18.3.1");
const { createRoot } = await import("https://esm.sh/react-dom@18.3.1/client");
const sucrase = await import("https://esm.sh/sucrase@3.35.0");
const { useState, useEffect, useCallback } = React;

function invoke(method, args) {
  return fetch("/api/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appId: APP_ID, method, args }),
  }).then((r) => r.json()).then((j) => {
    if (!j.ok && j.error) throw new Error(j.error);
    return j.value !== undefined ? j.value : j;
  });
}

function makeStorage(file) {
  return {
    async get(key) {
      const obj = (await invoke("storage.getFile", { key: file })) || {};
      return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
    },
    async set(key, value) {
      const obj = (await invoke("storage.getFile", { key: file })) || {};
      obj[key] = value;
      await invoke("storage.setFile", { key: file, value: obj });
    },
    async delete(key) {
      const obj = (await invoke("storage.getFile", { key: file })) || {};
      delete obj[key];
      await invoke("storage.setFile", { key: file, value: obj });
    },
    async clear() { await invoke("storage.setFile", { key: file, value: {} }); },
    table(name) { return makeStorage(String(name).replace(/[^A-Za-z0-9_-]/g, "_") + ".storage.json"); },
  };
}

function unsupported(name) {
  return async () => { throw new Error(name + " is not provided by this host (dsh plugin). Use storage / time.now."); };
}

function useDashboardApi(method, args, opts) {
  const call = useCallback(async (m, a) => {
    const j = await fetch("/api/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: APP_ID, method: m, args: a || {} }),
    }).then((r) => r.json());
    if (!j.ok) throw new Error(j.error || "call failed");
    return j.value;
  }, []);
  if (typeof method !== "string") return { call };
  const auto = !opts || opts.auto !== false;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!auto);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await call(method, args || {})); }
    catch (e) { setError(String(e && e.message || e)); }
    finally { setLoading(false); }
  }, [call, method, JSON.stringify(args || {})]);
  useEffect(() => { if (auto) void reload(); }, [reload, auto]);
  return { data, loading, error, reload, call };
}

const { createUiKit } = await import("/ui-kit.js");
const kit = createUiKit(React);
const uiBag = Object.assign({}, kit, { useDashboardApi });

const pack = await fetch("/api/app/" + encodeURIComponent(APP_ID) + "/files").then((r) => r.json());
const files = pack.files || {};
const compiled = {};
function resolveRel(from, spec) {
  if (!spec.startsWith(".")) return spec;
  const base = from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  let rel = base.join("/");
  const cands = [rel, rel + ".ts", rel + ".tsx", rel + ".js", rel + "/index.ts", rel + "/index.tsx"];
  for (const c of cands) if (files[c] != null) return c;
  throw new Error("cannot resolve " + spec + " from " + from);
}
function load(rel) {
  if (compiled[rel]) return compiled[rel].exports;
  const src = files[rel];
  if (src == null) throw new Error("missing file " + rel);
  const out = sucrase.transform(src, { transforms: ["typescript", "jsx", "imports"] });
  const mod = { exports: {} };
  compiled[rel] = mod;
  const req = (spec) => {
    if (spec === "react" || spec === "react/jsx-runtime") return React;
    if (spec === "@monkeyagent/ui") return uiBag;
    if (spec === "main.api.ts" || spec.indexOf("main.api") >= 0)
      throw new Error("ui must not import main.api.ts; use useDashboardApi");
    if (spec.startsWith(".")) return load(resolveRel(rel, spec));
    throw new Error("unsupported import: " + spec);
  };
  const fn = new Function("require", "module", "exports", "React", out.code + ";return module.exports;");
  fn(req, mod, mod.exports, React);
  return mod.exports;
}

try {
  const uiRel = files["ui.tsx"] ? "ui.tsx" : (files["ui.ts"] ? "ui.ts" : (files["App.tsx"] ? "App.tsx" : null));
  if (!uiRel) throw new Error("missing ui.tsx");
  const uiMod = load(uiRel);
  const App = uiMod.default || uiMod.App || uiMod;
  if (typeof App !== "function") throw new Error("ui.tsx must default-export a component");
  createRoot(document.getElementById("root")).render(React.createElement(App));
} catch (e) {
  document.getElementById("root").className = "err";
  document.getElementById("root").textContent = String((e && e.stack) || e);
}
</script>
</body>
</html>`;
}

  const appsHost = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const send = (code, body, type = "application/json; charset=utf-8") => {
      res.writeHead(code, { "Content-Type": type });
      res.end(body);
    };
    const appDirOf = (appId) => path7.join(runtimeRoot, "apps", appId);
    const readJsonSafe = (fp, fallback) => {
      try { return JSON.parse(fs3.readFileSync(fp, "utf8")); } catch { return fallback; }
    };
    const storageFile = (appId) => path7.join(appDirOf(appId), "storage", "default.json");
    try {
      if (url.pathname === "/ui-kit.js") {
        try {
          const { fileURLToPath } = await import("url");
          const dir = path7.dirname(fileURLToPath(import.meta.url));
          send(200, fs3.readFileSync(path7.join(dir, "ui-kit.js"), "utf8"), "application/javascript; charset=utf-8");
        } catch (e) {
          send(500, "ui-kit missing: " + e, "text/plain");
        }
        return;
      }
      if (url.pathname === "/health") { send(200, JSON.stringify({ ok: true, runtimeRoot })); return; }
      if (url.pathname === "/api/llm-config" && req.method === "GET") {
        send(200, JSON.stringify({ ok: true, ...readMiniLlmConfig(), defaults: { provider: "deepseek-official", model: "deepseek-v4-flash" } }));
        return;
      }
      if (url.pathname === "/api/llm-config" && req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        const root = process.env.MONKEY_MINI_APP_ROOT || (require("node:os").homedir() + "/.monkey-mini-app/runtime");
        const fp = require("node:path").join(String(root).replace(/^~\/.*/, require("node:os").homedir()), "llm.json");
        const next = { provider: body.provider || "deepseek-official", model: body.model || "deepseek-v4-flash" };
        require("fs").mkdirSync(require("node:path").dirname(fp), { recursive: true });
        require("fs").writeFileSync(fp, JSON.stringify(next, null, 2));
        send(200, JSON.stringify({ ok: true, ...next }));
        return;
      }
      if (url.pathname === "/api/apps" || url.pathname === "/api/monkey-mini-app/apps") {
        send(200, JSON.stringify(await handleApps())); return;
      }
      const srcMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/source$/);
      if (srcMatch) {
        const appId = decodeURIComponent(srcMatch[1]);
        const man = readJsonSafe(path7.join(appDirOf(appId), "manifest.json"), {}) || {};
        const entry = man.entry || "App.tsx";
        const fp = path7.join(appDirOf(appId), entry);
        if (!fs3.existsSync(fp)) { send(404, JSON.stringify({ error: "NO_ENTRY", path: fp })); return; }
        send(200, JSON.stringify({ appId, entry, source: fs3.readFileSync(fp, "utf8") }));
        return;
      }
      if (url.pathname === "/api/invoke" && req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        const appId = body.appId || "";
        const method = body.method || "";
        const file = storageFile(appId);
        fs3.mkdirSync(path7.dirname(file), { recursive: true });
        const store = readJsonSafe(file, {}) || {};
        if (method === "storage.get") { send(200, JSON.stringify({ ok: true, value: store[body.args && body.args.key] })); return; }
        if (method === "storage.set") {
          store[String(body.args && body.args.key)] = body.args && body.args.value;
          fs3.writeFileSync(file, JSON.stringify(store, null, 2));
          send(200, JSON.stringify({ ok: true }));
          return;
        }
        if (method === "storage.getFile") {
          const name = String((body.args && body.args.key) || "default.json");
          const fp = path7.join(appDirOf(appId), "storage", path7.basename(name));
          send(200, JSON.stringify({ ok: true, value: readJsonSafe(fp, {}) }));
          return;
        }
        if (method === "storage.setFile") {
          const name = String((body.args && body.args.key) || "default.json");
          const fp = path7.join(appDirOf(appId), "storage", path7.basename(name));
          fs3.mkdirSync(path7.dirname(fp), { recursive: true });
          fs3.writeFileSync(fp, JSON.stringify((body.args && body.args.value) || {}, null, 2));
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
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        try {
          const value = await callMainApi(appDirOf(String(body.appId || "")), String(body.method || ""), body.args);
          send(200, JSON.stringify({ ok: true, value }));
        } catch (e) {
          send(400, JSON.stringify({ ok: false, error: String(e && e.message || e) }));
        }
        return;
      }
      const filesMatch = url.pathname.match(/^\/api\/app\/([^/]+)\/files$/);
      if (filesMatch) {
        const appId = decodeURIComponent(filesMatch[1]);
        const root = appDirOf(appId);
        const files = {};
        const walk = (dir, prefix) => {
          if (!fs3.existsSync(dir)) return;
          for (const name of fs3.readdirSync(dir)) {
            if (name === "storage" || name === ".git" || name === "node_modules") continue;
            const full = path7.join(dir, name);
            const rel = prefix ? prefix + "/" + name : name;
            if (fs3.statSync(full).isDirectory()) walk(full, rel);
            else if (/\.(tsx?|jsx?|json|css)$/.test(name) && !/^main\.api\.(ts|js)$/.test(name)) files[rel] = fs3.readFileSync(full, "utf8");
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
        if (fs3.existsSync(dir)) fs3.rmSync(dir, { recursive: true, force: true });
        send(200, JSON.stringify({ ok: true, appId }));
        return;
      }
      const appMatch = url.pathname.match(/^\/app\/([^/]+)$/);
      if (appMatch) {
        send(200, appRunnerHtml(decodeURIComponent(appMatch[1])), "text/html; charset=utf-8");
        return;
      }
      send(404, JSON.stringify({ error: "not_found" }));
    } catch (e) {
      send(500, JSON.stringify({ error: String(e) }));
    }
  });
  try {
    await new Promise((resolve, reject) => {
      appsHost.once("error", reject);
      appsHost.listen(hostPort, "127.0.0.1", () => {
        appsHost.off("error", reject);
        resolve();
      });
    });
    const addr = appsHost.address();
    const bound = addr && typeof addr === "object" ? addr.port : hostPort;
    disposers.push(() => appsHost.close());
    console.log(`[monkey-mini-app] apps host http://127.0.0.1:${bound}`);
  } catch (e) {
    console.warn("[monkey-mini-app] embedded host listen failed", e);
  }

  console.log(
    `[monkey-mini-app] loaded \xB7 runtimeRoot=${runtimeRoot} \xB7 tools=${tools.length} \xB7 skill=${getSkillDir()}`
  );
  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
      }
    }
  };
}
var index_default = { name, inject, apply };
export {
  apply,
  index_default as default,
  inject,
  name
};
