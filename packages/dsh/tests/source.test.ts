import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = path.join(pkgDir, "src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("dsh package gates", () => {
  it("contains no @ts-nocheck", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("@ts-nocheck")) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });

  it("does not use Adapter as a primary seam name", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (/\bAdapter\b/.test(text)) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });

  it("does not contain the .monkey-mini-app path (bootstrap owns that string)", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes(".monkey-mini-app")) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });

  it("tsup wraps the browser client in dsh ModuleLoader CJS factory", () => {
    const tsup = readFileSync(path.join(pkgDir, "tsup.config.ts"), "utf8");
    expect(tsup).toContain("window.__ModuleLoader__.load");
    expect(tsup).toContain("@monkey-mini-app/dsh-mini-app");
    expect(tsup).toContain("return module.exports;");
    expect(tsup).toContain("src/index.ts");
    expect(tsup).toContain("src/client/index.ts");
  });
});
