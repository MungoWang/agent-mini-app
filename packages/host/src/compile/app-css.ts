/**
 * Per-app Tailwind CSS compilation (reliable).
 *
 * Runtime mini-apps live OUTSIDE this repo, so any class they use that never appears in
 * the repo silently no-ops (Tailwind only scans within its project root). This re-runs
 * Tailwind against a COPY of the app dir (real files, NOT a symlink — symlinked dirs are
 * scanned unreliably and can drop classes) so every class the app actually uses — in
 * ui.tsx AND any sub-component /lib file — is present. Cached on disk keyed by the
 * mtime of every app source file (editing a sub-component invalidates).
 */
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function findTailwind(): TailwindBin {
  for (let dir = resolveUiDistDir(); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const bin = path.join(dir, "node_modules", ".bin", "tailwindcss");
    if (hasFile(bin)) return { bin, root: dir };
  }
  throw new Error("tailwindcss CLI not found (run: pnpm install && node scripts/build-ui.mjs)");
}

function findBaseCss(): string {
  const dist = resolveUiDistDir();
  for (const c of [
    path.resolve(dist, "..", "src", "styles", "globals.css"),
    path.resolve(dist, "..", "..", "src", "styles", "globals.css"),
  ]) {
    if (hasFile(c)) return c;
  }
  throw new Error("ui globals.css source not found next to the ui dist");
}

/** All app source files whose classes belong in the app's css (UI + sub-components, not main.api.ts/manifest). */
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
      const p = path.join(dir, n);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (p.includes("node_modules") || p.includes("/storage")) continue;
        walk(p);
      } else if (/\.(ts|tsx|js|jsx)$/.test(n) && !/\.(test|spec)\./.test(n)) {
        out.push(p);
      }
    }
  };
  walk(appDir);
  return out;
}

function cacheSig(appDir: string): string {
  let max = 0;
  let count = 0;
  for (const fp of appFiles(appDir)) {
    try {
      const t = statSync(fp).mtimeMs;
      if (t > max) max = t;
      count++;
    } catch {
      /* missing */
    }
  }
  return `${max.toString(36)}-${count.toString(36)}`;
}

function cacheKey(appDir: string, sig: string): string {
  const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
  return `${id}-${sig}`;
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, _stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).slice(0, 400)));
      else resolve();
    });
  });
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

    const tailwind = findTailwind();
    const css = await this.buildCss(appDir, tailwind);
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cached, css);
    } catch {
      /* cache write non-fatal */
    }
    this.cache.set(appDir, { sig, css });
    return css;
  }

  private async buildCss(appDir: string, tw: TailwindBin): Promise<string> {
    const baseCss = findBaseCss();
    const id = path.basename(path.resolve(appDir)).replace(/[^A-Za-z0-9_-]/g, "_");
    // Copy the app dir into the tailwind project root (real files — no symlink, which
    // the Oxide scanner scans unreliably) and @source a RELATIVE path (Tailwind only
    // walks paths inside the project root). Per-app subdir avoids concurrency races.
    const scanBase = path.join(tw.root, SCAN_DIR);
    const scanApp = path.join(scanBase, id);
    const workDir = path.join(this.paths.uiCacheDir(), "css");
    const input = path.join(workDir, "input.css");
    const output = path.join(workDir, "styles.css");

    mkdirSync(scanBase, { recursive: true });
    mkdirSync(workDir, { recursive: true });
    rmSync(scanApp, { recursive: true, force: true });
    try {
      cpSync(appDir, scanApp, { recursive: true });
    } catch (cause) {
      throw new Error(`app css copy failed: ${cause instanceof Error ? cause.message : String(cause)}`);
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

export function appCssExists(appDir: string): boolean {
  return ["ui.tsx", "ui.ts", "App.tsx", "App.ts"].some((n) => existsSync(path.join(appDir, n)));
}
