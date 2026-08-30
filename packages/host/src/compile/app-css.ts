/**
 * Per-app Tailwind CSS compilation.
 *
 * The host serves a single prebuilt `packages/ui/dist/globals.css` at `/ui.css`,
 * but that is a one-time snapshot of classes found inside the repo. A mini-app
 * written by an agent lives in the runtime apps dir (outside the repo) and may use
 * classes that never appear in the repo (e.g. `gap-2.5`, `w-[320px]`, `grid-cols-3`)
 * — those silently no-op because Tailwind v4 only scans within its project root.
 *
 * This compiles a per-app stylesheet: it re-runs Tailwind against the app dir
 * (and the shared UI component sources), so every class the app actually uses is
 * present. Compilation stays host-side (the iframe never compiles, per AGENTS.md
 * #7); results are cached on disk under `.ui-cache/<id>-<sig>/styles.css` keyed
 * by the same mtime signature as the JS bundle.
 */
import { execFile } from "node:child_process";
import { cpSync, existsSync,mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import { resolveUiDistDir } from "./ui-compiler.ts";

const SCAN_DIR = ".mma-css-scan";

type TailwindBin = { bin: string; root: string };

function hasFile(fp: string): boolean {
  try {
    return statSync(fp).isFile();
  } catch {
    return false;
  }
}

/** Locate the Tailwind v4 CLI binary by walking up from the ui dist dir. */
function resolveTailwind(): TailwindBin {
  for (let dir = resolveUiDistDir(); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const bin = path.join(dir, "node_modules", ".bin", "tailwindcss");
    if (hasFile(bin)) {
      return { bin, root: dir };
    }
  }
  throw new Error("tailwindcss CLI not found (run: pnpm install && node scripts/build-ui.mjs)");
}

/** The UI source stylesheet (tokens + @layer base + component @source globs). */
function resolveBaseCss(): string {
  // packages/ui/dist → packages/ui/src/styles/globals.css
  const dist = resolveUiDistDir();
  const candidates = [
    path.resolve(dist, "..", "src", "styles", "globals.css"),
    path.resolve(dist, "..", "..", "src", "styles", "globals.css"),
  ];
  for (const c of candidates) {
    if (hasFile(c)) return c;
  }
  throw new Error("ui globals.css source not found next to the ui dist");
}

function cacheSig(appDir: string): string {
  let max = 0;
  let count = 0;
  const bump = (fp: string): void => {
    try {
      const t = statSync(fp).mtimeMs;
      if (t > max) max = t;
      count++;
    } catch {
      /* missing */
    }
  };
  for (const name of ["ui.tsx", "ui.ts", "App.tsx", "App.ts", "manifest.json"]) {
    bump(path.join(appDir, name));
  }
  return `${max.toString(36)}-${count.toString(36)}`;
}

function cacheKey(appDir: string, sig: string): string {
  const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
  return `${id}-${sig}`;
}

export class AppCssCompiler {
  private readonly cache = new Map<string, { sig: string; css: string }>();

  constructor(private readonly paths: WorkspacePaths) {}

  async compile(appDir: string): Promise<string> {
    const sig = cacheSig(appDir);
    const hit = this.cache.get(appDir);
    if (hit && hit.sig === sig) return hit.css;

    const cacheDir = path.join(this.paths.uiCacheDir(), cacheKey(appDir, sig));
    const cached = path.join(cacheDir, "styles.css");
    try {
      if (hasFile(cached)) {
        const css = readFileSync(cached, "utf8");
        this.cache.set(appDir, { sig, css });
        return css;
      }
    } catch {
      /* rebuild */
    }

    const tailwind = resolveTailwind();
    const css = await this.buildCss(appDir, tailwind);
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cached, css);
    } catch {
      /* cache write failure is non-fatal */
    }
    this.cache.set(appDir, { sig, css });
    return css;
  }

  private async buildCss(appDir: string, tw: TailwindBin): Promise<string> {
    const baseCss = resolveBaseCss();
    const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
    // Symlink the app into the tailwind project root so v4's scanner (which only
    // walks inside the project/install root) can see it. Per-app subdir avoids
    // races between concurrent first-loads. Clean up afterwards.
    const scanBase = path.join(tw.root, SCAN_DIR);
    const scanApp = path.join(scanBase, id);
    const workDir = path.join(this.paths.uiCacheDir(), "css");
    const input = path.join(workDir, "input.css");
    const output = path.join(workDir, "styles.css");

    mkdirSync(scanBase, { recursive: true });
    mkdirSync(workDir, { recursive: true });
    rmSync(scanApp, { recursive: true, force: true });
    try {
      symlinkSync(appDir, scanApp);
    } catch {
      // cross-device / tmpfs: copy instead of symlink
      cpSync(appDir, scanApp, { recursive: true });
    }

    const inputSrc = [
      `@import "${baseCss}";`,
      `@source "./${SCAN_DIR}/${id}/**/*.{ts,tsx}";`,
    ].join("\n") + "\n";
    writeFileSync(input, inputSrc);

    let stdoutText = "";
    try {
      await run(tw.bin, ["-i", input, "-o", output, "--minify", "--cwd", tw.root]);
      stdoutText = readFileSync(output, "utf8")
        // Geist 字体由 host 在 /files/:name 提供 —— 把相对 url(./files/…) 改成绝对 /files/…
        .split("url(./files/")
        .join("url(/files/");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`app css failed: ${message}`, { cause });
    } finally {
      rmSync(scanApp, { recursive: true, force: true });
    }
    return stdoutText;
  }
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

export function appCssExists(appDir: string): boolean {
  return [
    "ui.tsx",
    "ui.ts",
    "App.tsx",
    "App.ts",
  ].some((name) => existsSync(path.join(appDir, name)));
}
