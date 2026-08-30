/**
 * Host-side per-app UI bundling with esbuild (native, wasm fallback).
 *
 * @monkey-mini-app/ui dist is resolved via node and tree-shaken per app.
 * esbuild-wasm / esbuild stay runtime dependencies (node API spawns a binary).
 */
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildOptions, BuildResult, Plugin } from "esbuild";

import { HostError } from "../errors.ts";
import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import type { LocaleId } from "../types.ts";

const requireFromHere = createRequire(import.meta.url);

export type UiBuildFile = { name: string; contents: Uint8Array };

export type UiCompileOptions = {
  locale: LocaleId;
};

type EsbuildLike = {
  initialize?: (opts?: { wasmURL?: string }) => Promise<void>;
  build: (opts: BuildOptions) => Promise<BuildResult>;
};

let uiDistDir: string | null = null;
let esbuildReady: Promise<EsbuildLike> | null = null;

function distLooksValid(dir: string): boolean {
  return fs.existsSync(path.join(dir, "index.js"));
}

/**
 * Locate @monkey-mini-app/ui dist.
 * When host is bundled into dsh/lib, `import.meta.url` is the plugin bundle —
 * resolve from several bases + monorepo-relative fallbacks.
 */
export function resolveUiDistDir(): string {
  if (uiDistDir) return uiDistDir;

  const tryResolve = (fromFile: string): string | null => {
    try {
      const req = createRequire(fromFile);
      const pkgJson = req.resolve("@monkey-mini-app/ui/package.json");
      const dir = path.join(path.dirname(pkgJson), "dist");
      return distLooksValid(dir) ? dir : null;
    } catch {
      return null;
    }
  };

  const candidates: Array<string | null> = [
    tryResolve(path.join(path.dirname(fileURLToPath(import.meta.url)), "ui-compiler.ts")),
    tryResolve(import.meta.url),
    // bundled as packages/dsh/lib/index.js → walk up to repo packages/ui/dist
    (() => {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const guesses = [
        path.resolve(here, "../../../ui/dist"),
        path.resolve(here, "../../ui/dist"),
        path.resolve(here, "../../../../packages/ui/dist"),
      ];
      for (const g of guesses) {
        if (distLooksValid(g)) return g;
      }
      return null;
    })(),
  ];

  for (const dir of candidates) {
    if (dir) {
      uiDistDir = dir;
      return dir;
    }
  }

  // last resort: require from this module (works when running host from source)
  try {
    const pkgJson = requireFromHere.resolve("@monkey-mini-app/ui/package.json");
    const dir = path.join(path.dirname(pkgJson), "dist");
    if (distLooksValid(dir)) {
      uiDistDir = dir;
      return dir;
    }
  } catch {
    /* fall through */
  }

  throw new HostError(
    "UI_DIST_MISSING",
    "@monkey-mini-app/ui dist not found — run: node scripts/build-ui.mjs && ensure @monkey-mini-app/ui is a dependency of the running plugin",
  );
}

async function loadEsbuild(): Promise<EsbuildLike> {
  try {
    const mod = (await import(/* @vite-ignore */ "esbuild")) as unknown as EsbuildLike;
    if (typeof mod.build === "function") return mod;
  } catch {
    /* fall through to wasm */
  }
  const mod = (await import(/* @vite-ignore */ "esbuild-wasm")) as unknown as EsbuildLike;
  if (typeof mod.initialize === "function") {
    await mod.initialize();
  }
  return mod;
}

function getEsbuild(): Promise<EsbuildLike> {
  if (!esbuildReady) esbuildReady = loadEsbuild();
  return esbuildReady;
}

function uiLocale(locale: LocaleId): "zh" | "en" {
  return locale === "en" ? "en" : "zh";
}

function appIdOf(appDir: string): string {
  try {
    const man = JSON.parse(fs.readFileSync(path.join(appDir, "manifest.json"), "utf8")) as {
      id?: unknown;
    };
    if (typeof man.id === "string" && man.id) return man.id;
  } catch {
    /* fall through */
  }
  return path.basename(path.resolve(appDir));
}

function findUiEntry(appDir: string): string {
  for (const name of ["ui.tsx", "ui.ts", "App.tsx", "App.ts"]) {
    const p = path.join(appDir, name);
    if (fs.existsSync(p)) return p;
  }
  throw new HostError("MISSING_UI_ENTRY", "missing ui entry (ui.tsx / App.tsx)");
}

function makeUiPlugin(distDir: string, appId: string): Plugin {
  const req = createRequire(path.join(distDir, "index.js"));
  return {
    name: "monkey-mini-app-ui",
    setup(build) {
      build.onResolve({ filter: /(?:^|[\\/])main\.api\.(ts|js)$/ }, () => ({
        path: "main.api.ts",
        namespace: "mma-forbidden",
      }));
      build.onLoad({ filter: /.*/, namespace: "mma-forbidden" }, () => ({
        errors: [
          {
            text: "UI cannot import main.api.ts; use useDashboardApi() from @monkeyagent/host",
          },
        ],
      }));
      build.onResolve({ filter: /^@monkey-mini-app\/ui$/ }, () => ({
        path: path.join(distDir, "index.js"),
      }));
      build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
        try {
          return { path: req.resolve(args.path) };
        } catch {
          return { path: args.path, external: true };
        }
      });
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

function walkMtime(dir: string, bump: (fp: string) => void): void {
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (n === "storage" || n === ".git" || n === "node_modules" || n === ".ui-build") continue;
      walkMtime(full, bump);
    } else if (/\.(tsx?|jsx?|json|css)$/.test(n)) {
      bump(full);
    }
  }
}

/** Bundles a mini-app ui.tsx into self-contained ESM (entry.js + chunks). */
export class UiCompiler {
  private readonly buildCache = new Map<string, { sig: string; files: UiBuildFile[] }>();

  constructor(private readonly paths: WorkspacePaths) {}

  invalidate(appDir: string): void {
    this.buildCache.delete(appDir);
  }

  cacheSize(): number {
    return this.buildCache.size;
  }

  async compile(appDir: string, options: UiCompileOptions): Promise<UiBuildFile[]> {
    const locale = uiLocale(options.locale);
    const sig = `${this.cacheSig(appDir)}-${locale}`;
    const hit = this.buildCache.get(appDir);
    if (hit && hit.sig === sig) return hit.files;

    const cacheKey = this.cacheKey(appDir, sig);
    const cacheDir = path.join(this.paths.uiCacheDir(), cacheKey);
    try {
      if (fs.existsSync(path.join(cacheDir, "entry.js"))) {
        const names = fs.readdirSync(cacheDir).filter((n) => n.endsWith(".js"));
        const files = names
          .sort((a, b) => (a === "entry.js" ? -1 : b === "entry.js" ? 1 : a.localeCompare(b)))
          .map((n) => ({ name: n, contents: fs.readFileSync(path.join(cacheDir, n)) }));
        this.buildCache.set(appDir, { sig, files });
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
  createRoot(rootEl).render(<UiProvider locale=${JSON.stringify(locale)}><Ui /></UiProvider>);
}
`;
    let res: BuildResult;
    try {
      res = await esbuild.build({
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
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new HostError("UI_COMPILE_FAILED", message, { cause });
    }

    const output = res.outputFiles;
    if (!output || output.length === 0) {
      throw new HostError("UI_COMPILE_FAILED", "esbuild produced no output");
    }
    const files: UiBuildFile[] = output
      .map((o) => ({ name: path.basename(o.path), contents: o.contents }))
      .sort((a, b) => {
        const am = a.name === "entry.js" ? 0 : 1;
        const bm = b.name === "entry.js" ? 0 : 1;
        return am - bm || a.name.localeCompare(b.name);
      });
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      for (const f of files) {
        fs.writeFileSync(path.join(cacheDir, f.name), f.contents);
      }
    } catch {
      /* cache write failure is non-fatal */
    }
    this.buildCache.set(appDir, { sig, files });
    return files;
  }

  private cacheKey(appDir: string, sig: string): string {
    const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
    return `${id}-${sig}`;
  }

  private cacheSig(appDir: string): string {
    let max = 0;
    let count = 0;
    const bump = (fp: string): void => {
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
      walkMtime(appDir, bump);
    } catch {
      /* no extras */
    }
    try {
      walkMtime(resolveUiDistDir(), (fp) => {
        if (/\.(tsx?|jsx?|mjs|cjs|js|css|json)$/.test(path.basename(fp))) {
          bump(fp);
        }
      });
    } catch {
      /* ui dist unavailable */
    }
    return `${max.toString(36)}-${count.toString(36)}`;
  }
}
