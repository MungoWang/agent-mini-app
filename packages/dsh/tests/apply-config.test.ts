import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HostConfigError } from "@monkey-mini-app/host";

import { apply, inject, loadPluginHostConfig, name, resolveRuntimeRoot } from "../src/index.ts";

const srcFile = fileURLToPath(new URL("../src/index.ts", import.meta.url));

describe("plugin surface", () => {
  it("exports name, inject, apply and has no default export", () => {
    expect(name).toBe("monkey-mini-app");
    expect(inject).toEqual(["tools"]);
    expect(typeof apply).toBe("function");
    const src = readFileSync(srcFile, "utf8");
    expect(src).not.toMatch(/export default/);
  });
});

describe("loadPluginHostConfig / apply", () => {
  it("bootstraps a complete host.json when missing (first run)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-dsh-"));
    const cfg = loadPluginHostConfig({ runtimeRoot: dir });
    expect(cfg.runtimeRoot).toBe(dir);
    expect(existsSync(path.join(dir, "host.json"))).toBe(true);
  });

  it("does not invent theme/port when the file is partial", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-dsh-"));
    writeFileSync(path.join(dir, "host.json"), JSON.stringify({ runtimeRoot: dir, hostPort: 0 }));
    expect(() => loadPluginHostConfig({ runtimeRoot: dir })).toThrow(HostConfigError);
    expect(() => loadPluginHostConfig({ runtimeRoot: dir })).toThrow(/theme/);
  });

  it("loads a complete host.json from the provided runtimeRoot", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-dsh-"));
    mkdirSync(dir, { recursive: true });
    const raw = {
      runtimeRoot: dir,
      hostPort: 19191,
      theme: "dark",
      palette: "tokyo",
      locale: "en",
      chatLanguage: "en",
      llm: null,
    };
    writeFileSync(path.join(dir, "host.json"), JSON.stringify(raw));
    expect(loadPluginHostConfig({ runtimeRoot: dir })).toEqual(raw);
  });

  it("expands ~ and ~/ in plugin runtimeRoot locators", () => {
    expect(resolveRuntimeRoot({ runtimeRoot: "~" })).toBe(path.resolve(homedir()));
    expect(resolveRuntimeRoot({ runtimeRoot: "~/mma-runtime" })).toBe(path.resolve(homedir(), "mma-runtime"));
    expect(resolveRuntimeRoot({ runtimeRoot: "~\\mma-runtime" })).toBe(path.resolve(homedir(), "mma-runtime"));
    const seeded = resolveRuntimeRoot();
    expect(path.isAbsolute(seeded)).toBe(true);
  });
});
