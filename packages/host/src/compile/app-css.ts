/**
 * Per-app Tailwind CSS compilation (in place, under a `.autogen` dir).
 *
 * Each runtime app already lives in its own directory. Rather than copying the app into a
 * temp scan dir (which broke `@source` — it resolves relative to the input.css's own dir,
 * not `--cwd`), we compile in place:
 *
 *   <appDir>/.autogen/tailwind-gen.css   — build entry, host-written
 *   <appDir>/.autogen/ui.css             — compiled output, host-written
 *
 * The `.autogen` marker makes it obvious these are generated artifacts (the app author / AI
 * should not hand-edit them — any edit is overwritten on the next compile). The entry only
 * emits the app's OWN utilities (import tailwindcss with source disabled + a source glob that
 * scans the app root one level up), so responsive, arbitrary and app-only classes land here.
 * The shared base (theme tokens + shadcn + repo utilities) is served separately at `/ui.css`,
 * so we never import it by absolute path (Tailwind v4 strips that to a no-op), which keeps
 * working after publish (the npm package ships `dist/` only).
 *
 * `tailwindcss` is a dependency of `@monkey-mini-app/ui`, so the CLI is resolvable at runtime.
 * Because the app dir has no `node_modules`, we link `tailwindcss` into a SHARED runtime-root
 * `node_modules` (an ancestor of every app), so the import resolves. Freshness is the app's own
 * source mtime: an in-process rebuild happens whenever a source file is newer than the last build
 * the compiler memoized, so a class added after the first css request still lands (see
 * `packages/host/tests/app-css.test.ts` — the in-memory memo once made that untrue forever).
 */
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import { resolveUiDistDir } from "./ui-compiler.ts";

const AUTOGEN = ".autogen";
const GEN_CSS = "tailwind-gen.css";
const UI_CSS = "ui.css";

type TailwindBin = { bin: string; root: string };

function hasFile(fp: string): boolean {
  try {
    return statSync(fp).isFile();
  } catch {
    return false;
  }
}

function findTailwind(): TailwindBin {
  for (let dir = resolveUiDistDir(); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const bin = path.join(dir, "node_modules", ".bin", "tailwindcss");
    if (hasFile(bin)) return { bin, root: dir };
  }
  throw new Error("tailwindcss CLI not found (run: pnpm install && node scripts/build-ui.mjs)");
}

/** Resolve the tailwindcss package dir from a tailwind project root (has .bin/tailwindcss). */
function resolveTailwindPackage(root: string): string {
  const req = createRequire(path.join(root, "package.json"));
  const pkgJson = req.resolve("tailwindcss/package.json");
  return path.dirname(pkgJson);
}

/** All app source files whose classes belong in the app's css (UI + sub-components). */
function appFiles(appDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const n of names) {
      if (n === AUTOGEN || n === "node_modules") continue;
      const p = path.join(dir, n);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(p);
      } else if (/\.(ts|tsx|js|jsx)$/.test(n) && !/\.(test|spec)\./.test(n)) {
        out.push(p);
      }
    }
  };
  walk(appDir);
  return out;
}

function maxMtime(appDir: string): number {
  let max = 0;
  for (const fp of appFiles(appDir)) {
    try {
      const t = statSync(fp).mtimeMs;
      if (t > max) max = t;
    } catch {
      /* missing */
    }
  }
  return max;
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, _stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).slice(0, 600)));
      else resolve();
    });
  });
}

export class AppCssCompiler {
  /** Memo for the freshness check below — keyed by the source mtime the css was built from. */
  private readonly cache = new Map<string, { css: string; builtFromMtime: number }>();

  constructor(private readonly paths: WorkspacePaths) {}

  /** Drop the memoized build for this app; the next request recompiles from source. */
  invalidate(appDir: string): void {
    this.cache.delete(appDir);
  }

  /**
   * Also throw away the on-disk build (`.autogen/`), so the next request cannot even read a
   * stale `ui.css` back from disk. For the rare case where the agent suspects the artifact
   * itself, not just the memo — `mini_app_reload({ cleanCaches: true })`.
   */
  purge(appDir: string): void {
    this.invalidate(appDir);
    try {
      rmSync(path.join(appDir, AUTOGEN), { recursive: true, force: true });
    } catch {
      /* unwritable dir: the memo drop alone still forces a rebuild attempt */
    }
  }

  async compile(appDir: string): Promise<string> {
    const maxSrc = maxMtime(appDir);

    // The map must never outlive the sources it was built from. It used to be consulted before
    // any freshness check, so the mtime rule below only ever guarded the *disk* path: one
    // compiler lives per host process, which meant a class the agent added after the app's first
    // css request compiled into nothing for the rest of that process's life — silently, with the
    // app still looking styled because the shared base sheet answered for it.
    const hit = this.cache.get(appDir);
    if (hit !== undefined && hit.builtFromMtime >= maxSrc) return hit.css;

    const genCss = path.join(appDir, AUTOGEN, GEN_CSS);
    const uiCss = path.join(appDir, AUTOGEN, UI_CSS);

    // Cache = the app's own generated ui.css; recompile only when a source file is newer or
    // the output is absent (so a hand-edit to ui.css is always overwritten by the next compile).
    if (maxSrc > 0 && existsSync(uiCss) && statSync(uiCss).mtimeMs >= maxSrc) {
      const css = readFileSync(uiCss, "utf8");
      this.cache.set(appDir, { css, builtFromMtime: maxSrc });
      return css;
    }

    const css = await this.buildCss(appDir, genCss, uiCss);
    // The CLI takes ~1s; re-read what is on disk now rather than claiming freshness the sources
    // may have taken away while it ran.
    this.cache.set(appDir, { css, builtFromMtime: Math.max(maxSrc, maxMtime(appDir)) });
    return css;
  }

  private async buildCss(appDir: string, genCss: string, uiCss: string): Promise<string> {
    const tw = findTailwind();
    this.ensureTailwindLink(tw);
    mkdirSync(path.dirname(genCss), { recursive: true });

    writeFileSync(
      genCss,
      [
        '@import "tailwindcss" source(none);',
        '@source "../*.{ts,tsx,js,jsx}";',
        '@source "../**/*.{ts,tsx,js,jsx}";',
      ].join("\n") + "\n",
    );

    await run(tw.bin, ["-i", genCss, "-o", uiCss, "--minify", "--cwd", appDir]);
    return readFileSync(uiCss, "utf8");
  }

  /** Link tailwindcss into a shared runtime-root node_modules so every app can resolve it. */
  private ensureTailwindLink(tw: TailwindBin): void {
    const parent = path.join(this.paths.root, "node_modules");
    const link = path.join(parent, "tailwindcss");
    if (existsSync(link)) return;
    mkdirSync(parent, { recursive: true });
    let target = path.join(parent, "tailwindcss");
    try {
      target = resolveTailwindPackage(tw.root);
    } catch {
      /* leave target as-is; symlink below will fail loudly if unresolvable */
    }
    symlinkSync(target, link, "dir");
  }
}

export function appCssExists(appDir: string): boolean {
  return ["ui.tsx", "ui.ts", "App.tsx", "App.ts"].some((n) => existsSync(path.join(appDir, n)));
}
