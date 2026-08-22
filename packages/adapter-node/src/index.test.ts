import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { expandHome, resolvePaths } from "./index.js";

describe("adapter-node paths", () => {
  it("expands ~", () => {
    const p = expandHome("~/foo");
    expect(p.startsWith(os.homedir())).toBe(true);
    expect(p.endsWith(`${path.sep}foo`)).toBe(true);
  });

  it("resolvePaths respects overrides", () => {
    const r = resolvePaths({
      runtimeRoot: "/tmp/mma-runtime",
      sharedRoot: "/tmp/mma-shared",
    });
    expect(r.runtimeRoot).toBe("/tmp/mma-runtime");
    expect(r.sharedRoot).toBe("/tmp/mma-shared");
  });
});
