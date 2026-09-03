import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  bootstrapHostConfig,
  GitHistory,
  UiCompiler,
  WorkspacePaths,
  AppsManager,
} from "@monkey-mini-app/host";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const fixtureDir = path.join(repoRoot, "apps/dsh-host/fixtures/com.example.kit");
const examplesSrc = path.join(repoRoot, "packages/ui-examples/src/components");

/**
 * S7 · the e2e fixture app is generated from the shared examples package
 * (`pnpm gen:examples`). Two jobs:
 *
 * 1. the generated tree must still compile as a real mini-app (api + ui);
 * 2. nothing may silently drop out of the generator — a source example that
 *    never reaches `lib/examples/` or `lib/sections.tsx` would make the fixture
 *    quietly cover less than the gallery does.
 */
function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...walk(path.join(dir, ent.name), rel));
    else if (/\.(ts|tsx|json)$/.test(ent.name)) out.push(rel);
  }
  return out;
}

function componentExamples(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...componentExamples(full, prefix ? `${prefix}/${ent.name}` : ent.name));
    else if (ent.name.endsWith(".tsx")) out.push(prefix ? `${prefix}/${ent.name}` : ent.name);
  }
  return out;
}

describe("S7 · kit fixture is generated from ui-examples", () => {
  it("every source example is copied and composed", () => {
    const sources = componentExamples(examplesSrc).sort();
    expect(sources.length).toBeGreaterThan(50);

    const copied = componentExamples(path.join(fixtureDir, "lib/examples")).map((p) => p.replace(/^examples\//, ""));
    const sections = readFileSync(path.join(fixtureDir, "lib/sections.tsx"), "utf8");

    const missingCopy = sources.filter((p) => !copied.includes(p));
    const missingImport = sources.filter((p) => !sections.includes(`./examples/${p.replace(/\.tsx$/, "")}"`));
    expect(missingCopy, "not copied into lib/examples").toEqual([]);
    expect(missingImport, "not imported by lib/sections.tsx").toEqual([]);
  });

  it("registers, compiles api + ui, and answers a call", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mma-kitfx-"));
    const config = bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 });
    const paths = new WorkspacePaths(config.runtimeRoot);
    const apps = new AppsManager(paths, {}, new GitHistory(), config);
    const compiler = new UiCompiler(paths);
    apps.setUiCompiler(compiler);

    const files: Record<string, string> = {};
    for (const rel of walk(fixtureDir)) files[rel] = readFileSync(path.join(fixtureDir, rel), "utf8");

    await apps.register("com.example.kit", files);
    const res = await apps.reload("com.example.kit");
    expect(res.errors, res.errors.join("\n")).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.compiled).toEqual({ api: true, ui: true });
  });
});
