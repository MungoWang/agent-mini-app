import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const panelDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = path.join(panelDir, "src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|json)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("panel package gates", () => {
  it("contains no /api/ strings", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("/api/")) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });

  it("does not depend on @monkey-mini-app/ui", () => {
    const pkg = JSON.parse(readFileSync(path.join(panelDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
    expect(all["@monkey-mini-app/ui"]).toBeUndefined();
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("@monkey-mini-app/ui")) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });

  it("does not mention MiniAppAdapter (renamed to PanelHost)", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("MiniAppAdapter")) hits.push(path.relative(srcDir, file));
    }
    expect(hits).toEqual([]);
  });
});
