import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

function readDist(name: "runtime.js" | "sdk.js"): string {
  const file = path.join(distDir, name);
  if (!fs.existsSync(file)) {
    throw new Error(`${name} missing — run: node scripts/build-sdk.mjs`);
  }
  return fs.readFileSync(file, "utf8");
}

function exportedNames(js: string): string[] {
  const names: string[] = [];
  for (const block of js.matchAll(/export\{([^}]+)\}/g)) {
    for (const part of block[1].split(",")) {
      const bits = part.split(" as ");
      const name = (bits[1] ?? bits[0]).trim();
      if (name) names.push(name);
    }
  }
  return names;
}

describe("sdk dist ABI", () => {
  it("runtime.js has real ESM named exports (not a default-only CJS barrel)", () => {
    const js = readDist("runtime.js");
    const names = exportedNames(js);
    expect(names.length).toBeGreaterThan(10);
    for (const name of [
      "useState",
      "useLayoutEffect",
      "memo",
      "createElement",
      "createRoot",
      "jsx",
      "jsxs",
      "default",
    ]) {
      expect(names, `missing export ${name}`).toContain(name);
    }
  });

  it("sdk.js externals react* to /mma/runtime.js and only requires that URL", () => {
    const js = readDist("sdk.js");
    expect(js).toContain("useApp");
    expect(js).toMatch(/from\s*["']\/mma\/runtime\.js["']/);
    expect(js).toContain('if(n==="/mma/runtime.js")');
    expect(js).not.toMatch(/from\s*["']react["']/);
    expect(js).not.toMatch(/from\s*["']react-dom(\/|$)/);
    const required = [...js.matchAll(/\brequire\((["'`])([^"'`]+)\1\)/g)].map((m) => m[2]);
    expect(required.every((spec) => spec === "/mma/runtime.js")).toBe(true);
  });
});
