/**
 * Host-side per-app UI bundling with esbuild (native, wasm fallback).
 *
 * Iframe platform:
 *   /mma/runtime.js — React (complete, not curated)
 *   /mma/sdk.js     — UI kit + useApp (react is external to runtime.js)
 * App compile only bundles the mini-app's own ui.tsx + ui/** + shared/**;
 * relative imports are bounds-checked to stay inside the app dir.
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

export const RUNTIME_HREF = "/mma/runtime.js";
export const SDK_HREF = "/mma/sdk.js";

const RUNTIME_SPECIFIER = /^(react|react-dom)(\/.*)?$/;
/**
 * Author-facing SDK specifier. Exactly one — `@monkeyagent/host` and
 * `@monkey-mini-app/ui` used to be aliased here too and are gone (hard cut):
 * mini-apps import `@monkey-mini-app/sdk`, nothing else.
 */
const SDK_SPECIFIER = /^(lucide-react|@monkey-mini-app\/sdk)(\/.*)?$/;

export type UiBuildFile = { name: string; contents: Uint8Array };

export type UiCompileOptions = {
  locale: LocaleId;
};

type EsbuildLike = {
  initialize?: (opts?: { wasmURL?: string }) => Promise<void>;
  build: (opts: BuildOptions) => Promise<BuildResult>;
};

let uiDistDir: string | null = null;
let sdkDistDir: string | null = null;
let esbuildReady: Promise<EsbuildLike> | null = null;

function uiDistLooksValid(dir: string): boolean {
  return fs.existsSync(path.join(dir, "index.js")) && fs.existsSync(path.join(dir, "globals.css"));
}

function sdkFileLooksValid(dir: string): boolean {
  return fs.existsSync(path.join(dir, "sdk.js")) && fs.existsSync(path.join(dir, "runtime.js"));
}

function resolvePkgDist(
  pkg: string,
  distRel: string,
  looksValid: (dir: string) => boolean,
): string | null {
  const tryResolve = (fromFile: string): string | null => {
    try {
      const req = createRequire(fromFile);
      const pkgJson = req.resolve(`${pkg}/package.json`);
      const dir = path.join(path.dirname(pkgJson), distRel);
      return looksValid(dir) ? dir : null;
    } catch {
      return null;
    }
  };
  return tryResolve(path.join(path.dirname(fileURLToPath(import.meta.url)), "ui-compiler.ts"))
    ?? tryResolve(import.meta.url);
}

/**
 * Locate @monkey-mini-app/ui dist (stylesheet + fonts).
 * When host is bundled into dsh/lib, `import.meta.url` is the plugin bundle.
 */
export function resolveUiDistDir(): string {
  if (uiDistDir) return uiDistDir;

  const fromPkg = resolvePkgDist("@monkey-mini-app/ui", "dist", uiDistLooksValid);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guesses = [
    fromPkg,
    path.resolve(here, "../../../ui/dist"),
    path.resolve(here, "../../ui/dist"),
    path.resolve(here, "../../../../packages/ui/dist"),
  ];
  for (const dir of guesses) {
    if (dir && uiDistLooksValid(dir)) {
      uiDistDir = dir;
      return dir;
    }
  }
  try {
    const pkgJson = requireFromHere.resolve("@monkey-mini-app/ui/package.json");
    const dir = path.join(path.dirname(pkgJson), "dist");
    if (uiDistLooksValid(dir)) {
      uiDistDir = dir;
      return dir;
    }
  } catch {
    /* fall through */
  }
  throw new HostError(
    "UI_DIST_MISSING",
    "@monkey-mini-app/ui dist not found — run: node scripts/build/ui.mjs && ensure @monkey-mini-app/ui is a dependency of the running plugin",
  );
}

/** Locate @monkey-mini-app/sdk dist/sdk.js (iframe environment). */
export function resolveSdkDistDir(): string {
  if (sdkDistDir) return sdkDistDir;

  const fromPkg = resolvePkgDist("@monkey-mini-app/sdk", "dist", sdkFileLooksValid);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guesses = [
    fromPkg,
    path.resolve(here, "../../../sdk/dist"),
    path.resolve(here, "../../sdk/dist"),
    path.resolve(here, "../../../../packages/sdk/dist"),
  ];
  for (const dir of guesses) {
    if (dir && sdkFileLooksValid(dir)) {
      sdkDistDir = dir;
      return dir;
    }
  }
  try {
    const pkgJson = requireFromHere.resolve("@monkey-mini-app/sdk/package.json");
    const dir = path.join(path.dirname(pkgJson), "dist");
    if (sdkFileLooksValid(dir)) {
      sdkDistDir = dir;
      return dir;
    }
  } catch {
    /* fall through */
  }
  throw new HostError(
    "SDK_DIST_MISSING",
    "@monkey-mini-app/sdk dist/sdk.js not found — run: node scripts/build/ui.mjs && node scripts/build/sdk.mjs",
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

/** Trees a mini-app UI may not import (backend-only code). */
const UI_FORBIDDEN_TREE = /^api(\/|$)/;

/**
 * esbuild hands us realpath'd paths, so a macOS tmpdir (`/var/…` → `/private/var/…`)
 * would make a naive `path.relative` see an escape where there is none. Compare
 * canonical directories on both sides.
 */
function realDir(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

function makeUiPlugin(appDir: string): Plugin {
  const root = realDir(appDir);
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
            text: "UI cannot import main.api.ts; use useApp() from @monkey-mini-app/sdk",
          },
        ],
      }));
      // Relative imports: stay inside the app dir, and keep out of api/**.
      // Bare specifiers never reach here (RUNTIME/SDK hooks, else unresolvable).
      build.onResolve({ filter: /^\.\.?\// }, (args) => {
        const fromDir = realDir(args.resolveDir || appDir);
        const rel = path
          .relative(root, path.resolve(fromDir, args.path))
          .split(path.sep)
          .join("/");
        if (rel === "" || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) {
          const importer = args.importer ? path.basename(args.importer) : "the UI entry";
          return {
            errors: [
              {
                text: `UI import escapes the app dir: "${args.path}" (imported from ${importer})`,
              },
            ],
          };
        }
        if (UI_FORBIDDEN_TREE.test(rel)) {
          return {
            errors: [
              {
                text: `UI cannot import api/**: "${args.path}" — shared code belongs in shared/**`,
              },
            ],
          };
        }
        return undefined;
      });
      build.onResolve({ filter: RUNTIME_SPECIFIER }, () => ({
        path: RUNTIME_HREF,
        external: true,
      }));
      build.onResolve({ filter: SDK_SPECIFIER }, () => ({
        path: SDK_HREF,
        external: true,
      }));
    },
  };
}

function walkMtime(dir: string, bump: (fp: string) => void): void {
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (n === "storage" || n === ".git" || n === "node_modules" || n === ".ui-build" || n === ".autogen") continue;
      walkMtime(full, bump);
    } else if (/\.(tsx?|jsx?|json|css)$/.test(n)) {
      bump(full);
    }
  }
}

/** Bundles a mini-app ui.tsx into ESM that imports the host SDK. */
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

    resolveSdkDistDir();
    const esbuild = await getEsbuild();
    const entry = findUiEntry(appDir);
    const uiRel = path.basename(entry);
    const appId = JSON.stringify(appIdOf(appDir));
    const wrapper = `
import { createRoot } from "react-dom/client";
import { AppRuntime, UiProvider } from "@monkey-mini-app/sdk";
import Ui from "./${uiRel}";
const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.className = "";
  rootEl.removeAttribute("role");
  rootEl.removeAttribute("aria-label");
  rootEl.replaceChildren();
  createRoot(rootEl).render(
    <AppRuntime appId={${appId}}>
      <UiProvider locale=${JSON.stringify(locale)}><Ui /></UiProvider>
    </AppRuntime>
  );
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
        plugins: [makeUiPlugin(appDir)],
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
      const sdkDir = resolveSdkDistDir();
      bump(path.join(sdkDir, "sdk.js"));
      bump(path.join(sdkDir, "runtime.js"));
    } catch {
      /* sdk dist unavailable */
    }
    try {
      bump(path.join(resolveUiDistDir(), "globals.css"));
    } catch {
      /* ui dist unavailable */
    }
    return `${max.toString(36)}-${count.toString(36)}`;
  }
}
