import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const FORBIDDEN = [
  "@deepseek-ai/dsh-llm",
  "openai",
  "@anthropic-ai/sdk",
  "@earendil-works/pi-coding-agent",
];

describe("constitution: host owns no AI providers", () => {
  it("package.json dependencies exclude provider SDKs", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(dir, "../package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const all = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    for (const name of FORBIDDEN) {
      expect(all[name], name).toBeUndefined();
    }
  });
});
