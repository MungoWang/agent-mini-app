/**
 * Host-side per-app UI bundling with esbuild-wasm.
 *
 * @monkey-mini-app/ui is a real npm dependency of this plugin. At runtime its
 * dist (flat named-export index + source + globals.css) is resolved via node,
 * and esbuild's reachability analysis tree-shakes per app — a simple app ships
 * ~60KB instead of the full 2.7MB library. npm deps (Base UI, recharts, …)
 * resolve natively from node_modules (self-reference via the package exports).
 *
 * esbuild-wasm must stay external in the dsh-plugin bundle (its node API spawns
 * `bin/esbuild` and refuses to be bundled), so it is a runtime dependency.
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export type UiBuildFile = { name: string; contents: Uint8Array };

let uiDistDir: string | null = null;

/** Locate @monkey-mini-app/ui dist via node resolution. */
export function resolveUiDistDir(): string {
  if (uiDistDir) return uiDistDir;
  const pkgJson = require.resolve("@monkey-mini-app/ui/package.json");
  uiDistDir = path.join(path.dirname(pkgJson), "dist");
  if (!fs.existsSync(path.join(uiDistDir, "index.js"))) {
    throw new Error(
      "@monkey-mini-app/ui dist missing — run: pnpm --filter @monkey-mini-app/ui build:dist"
    );
  }
  return uiDistDir;
}

function resolveFile(p: string): string | null {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  } catch {
    return null;
  }
  for (const ext of [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".css", ".json"]) {
    const f = p + ext;
    try {
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    } catch {
      /* ignore */
    }
  }
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      for (const ext of [".tsx", ".ts", ".jsx", ".js", ".mjs"]) {
        const i = path.join(p, "index" + ext);
        if (fs.existsSync(i) && fs.statSync(i).isFile()) return i;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

type EsbuildLike = {
  initialize: (opts?: { wasmURL?: string }) => Promise<void>;
  build: (opts: Record<string, unknown>) => Promise<{ outputFiles: Array<{ path: string; contents: Uint8Array }> }>;
  stop: () => Promise<void>;
};

async function loadEsbuild(): Promise<EsbuildLike> {
  // Prefer native esbuild (much faster; ~200ms vs wasm ~2.5s). Falls back to
  // esbuild-wasm when the native binary is unavailable. Both must stay external
  // in the bundle (the node API spawns a binary and refuses to be bundled).
  try {
    const mod = (await import(/* @vite-ignore */ "esbuild")) as unknown as EsbuildLike;
    if (typeof mod.build === "function") return mod;
  } catch {
    /* fall through to wasm */
  }
  const mod = (await import(/* @vite-ignore */ "esbuild-wasm")) as unknown as EsbuildLike;
  await mod.initialize();
  return mod;
}

let esbuildReady: Promise<EsbuildLike> | null = null;
function getEsbuild(): Promise<EsbuildLike> {
  if (!esbuildReady) esbuildReady = loadEsbuild();
  return esbuildReady;
}

/** Dedupe concurrent builds of the same app (dashboard warm vs first open). */
const inFlight = new Map<string, Promise<UiBuildFile[]>>();

function makeUiPlugin(distDir: string, appId: string) {
  const req = createRequire(path.join(distDir, "index.js"));
  return {
    name: "monkey-mini-app-ui",
    setup(build: any) {
      // Root spec comes from the app's ui.tsx (outside node_modules) — point it
      // at the flat index manually. Subpaths resolve via self-reference exports.
      build.onResolve({ filter: /^@monkey-mini-app\/ui$/ }, () => ({
        path: path.join(distDir, "index.js"),
      }));
      // react / react-dom resolve from the ui package's node_modules and are
      // bundled INTO the app bundle (CJS → ESM by esbuild), so the page is
      // fully self-contained (no import map / CDN) and Base UI's CJS
      // require("react") works in the browser.
      build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a: any) => {
        try {
          return { path: req.resolve(a.path) };
        } catch {
          return { path: a.path, external: true };
        }
      });
      // useDashboardApi is implemented inside the bundle (has access to React
      // hooks); only the app id is injected at build time.
      build.onResolve({ filter: /^@monkeyagent\/host$/ }, () => ({
        namespace: "mma-host",
        path: "useDashboardApi",
      }));
      build.onLoad({ filter: /.*/, namespace: "mma-host" }, () => ({
        contents: `
import { useCallback } from "react";
const __MMA_APP_ID = ${JSON.stringify(appId)};
export function useDashboardApi() {
  const call = useCallback(async (m, a) => {
    const j = await fetch("/api/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: __MMA_APP_ID, method: m, args: a || {} }),
    }).then((r) => r.json());
    if (!j.ok) throw new Error(j.error || "call failed");
    return j.value;
  }, []);
  return { call };
}
`,
        loader: "js",
      }));
    },
  };
}

const buildCache = new Map<string, { sig: string; files: UiBuildFile[] }>();

/** Disk cache dir lives next to apps/ (runtime/.ui-cache) so restarts keep warm builds. */
function uiCacheDir(appDir: string): string {
  return path.join(path.resolve(appDir, "..", ".."), ".ui-cache");
}

function uiCacheKey(appDir: string, sig: string): string {
  const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
  return id + "-" + sig;
}

/**
 * Cache signature for an app's UI bundle.
 *
 * Invalidation input = (mtime-max of every source file in the app dir) + file
 * count (so deleting a non-max file still busts the cache) + the @monkey-mini-app/ui
 * dist mtime (component library upgrades must rebuild every app).
 */
function uiCacheSig(appDir: string): string {
  let max = 0;
  let count = 0;
  const bump = (fp: string) => {
    try {
      const t = fs.statSync(fp).mtimeMs;
      if (t > max) max = t;
      count++;
    } catch {
      /* missing */
    }
  };
  for (const name of ["ui.tsx", "ui.ts", "App.tsx", "App.ts", "manifest.json"]) {
    bump(path.join(appDir, name));
  }
  try {
    const walk = (d: string) => {
      for (const n of fs.readdirSync(d)) {
        const full = path.join(d, n);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          if (n === "storage" || n === ".git" || n === "node_modules" || n === ".ui-build") continue;
          walk(full);
        } else if (/\.(tsx?|jsx?|json|css)$/.test(n)) {
          if (st.mtimeMs > max) max = st.mtimeMs;
          count++;
        }
      }
    };
    walk(appDir);
  } catch {
    /* no extras */
  }
  // ui dist: ANY component file change (rebuild via build-ui.mjs, or hand-edited
  // dist/src copy) must invalidate every app's cached bundle.
  try {
    const distDir = resolveUiDistDir();
    const walk = (d: string) => {
      for (const n of fs.readdirSync(d)) {
        const full = path.join(d, n);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (/\.(tsx?|jsx?|mjs|cjs|js|css|json)$/.test(n)) {
          if (st.mtimeMs > max) max = st.mtimeMs;
          count++;
        }
      }
    };
    walk(distDir);
  } catch {
    /* ui dist unavailable — signature still valid for the app files */
  }
  return max.toString(36) + "-" + count.toString(36);
}

function findUiEntry(appDir: string): string {
  for (const name of ["ui.tsx", "ui.ts", "App.tsx", "App.ts"]) {
    const p = path.join(appDir, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("missing ui entry (ui.tsx / App.tsx)");
}

/** App id for the call protocol: manifest.id, else directory name. */
export function appIdOf(appDir: string): string {
  try {
    const man = JSON.parse(fs.readFileSync(path.join(appDir, "manifest.json"), "utf8")) as { id?: unknown };
    if (typeof man.id === "string" && man.id) return man.id;
  } catch {
    /* fall through */
  }
  return path.basename(path.resolve(appDir));
}

/**
 * Bundle a mini-app ui.tsx → ESM files (main entry.js + optional lazy chunks).
 * Entry is a virtual wrapper that injects UiProvider, so app code never needs
 * to import it. Cached by app-dir signature (see uiCacheSig); throws friendly
 * errors on unsupported imports (npm / node builtins / main.api.ts).
 */
export async function compileUiBundle(appDir: string): Promise<UiBuildFile[]> {
  const sig = uiCacheSig(appDir);
  const hit = buildCache.get(appDir);
  if (hit && hit.sig === sig) return hit.files;

  // Disk cache: warm builds survive host restarts.
  const cacheKey = uiCacheKey(appDir, sig);
  const cacheDir = path.join(uiCacheDir(appDir), cacheKey);
  try {
    if (fs.existsSync(path.join(cacheDir, "entry.js"))) {
      const names = fs.readdirSync(cacheDir).filter((n) => n.endsWith(".js"));
      const files = names
        .sort((a, b) => (a === "entry.js" ? -1 : b === "entry.js" ? 1 : a.localeCompare(b)))
        .map((n) => ({ name: n, contents: fs.readFileSync(path.join(cacheDir, n)) }));
      buildCache.set(appDir, { sig, files });
      return files;
    }
  } catch {
    /* corrupted cache → rebuild */
  }

  const distDir = resolveUiDistDir();
  const esbuild = await getEsbuild();
  const entry = findUiEntry(appDir);
  const uiRel = path.basename(entry);
  const wrapper = `
import { createRoot } from "react-dom/client";
import { UiProvider } from "@monkey-mini-app/ui";
import Ui from "./${uiRel}";
const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.className = "";
  rootEl.removeAttribute("role");
  rootEl.removeAttribute("aria-label");
  rootEl.replaceChildren();
  createRoot(rootEl).render(<UiProvider locale="zh"><Ui /></UiProvider>);
}
`;
  const res = await esbuild.build({
    stdin: {
      contents: wrapper,
      resolveDir: appDir,
      sourcefile: "entry.tsx",
      loader: "tsx",
    },
    outfile: path.join(appDir, ".ui-build", "entry.js"),
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    target: "es2020",
    plugins: [makeUiPlugin(distDir, appIdOf(appDir))],
    loader: { ".tsx": "tsx", ".ts": "ts" },
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    legalComments: "none",
    logLevel: "silent",
  });

  // Main output is entry.js (virtual wrapper); chunks follow. Sort stable.
  const files: UiBuildFile[] = res.outputFiles
    .map((o) => ({ name: path.basename(o.path), contents: o.contents }))
    .sort((a, b) => {
      const am = a.name === "entry.js" ? 0 : 1;
      const bm = b.name === "entry.js" ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
  // Persist to disk cache (best-effort).
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const f of files) {
      fs.writeFileSync(path.join(cacheDir, f.name), f.contents);
    }
  } catch {
    /* cache write failure is non-fatal */
  }
  buildCache.set(appDir, { sig, files });
  return files;
}

/** Drop cached builds for an app (on delete). */
export function invalidateUiCache(appDir: string) {
  buildCache.delete(appDir);
}

export function uiBuildCacheSize() {
  return buildCache.size;
}
