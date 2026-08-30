import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveAgentCwd } from "../src/agent-cwd.ts";
import { HostError } from "../src/errors.ts";

describe("resolveAgentCwd", () => {
  it("defaults to process.cwd()", () => {
    expect(resolveAgentCwd({})).toBe(path.resolve(process.cwd()));
    expect(resolveAgentCwd({ cwdType: "process" })).toBe(path.resolve(process.cwd()));
  });

  it("resolves app from appDir", () => {
    const appDir = mkdtempSync(path.join(tmpdir(), "mma-app-"));
    expect(resolveAgentCwd({ cwdType: "app" }, { appDir })).toBe(path.resolve(appDir));
  });

  it("requires appDir for cwdType app", () => {
    expect(() => resolveAgentCwd({ cwdType: "app" })).toThrow(HostError);
  });

  it("creates a temp directory for cwdType temp", () => {
    const dir = resolveAgentCwd({ cwdType: "temp" });
    expect(path.isAbsolute(dir)).toBe(true);
    expect(dir.includes("mma-agent-")).toBe(true);
  });

  it("treats cwd alone as custom", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-custom-"));
    expect(resolveAgentCwd({ cwd: dir })).toBe(path.resolve(dir));
  });

  it("rejects cwd with non-custom cwdType", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-x-"));
    expect(() => resolveAgentCwd({ cwdType: "app", cwd: dir }, { appDir: dir })).toThrow(
      /conflicts/,
    );
  });

  it("requires cwd for custom", () => {
    expect(() => resolveAgentCwd({ cwdType: "custom" })).toThrow(/requires cwd/);
  });

  it("rejects relative cwd", () => {
    expect(() => resolveAgentCwd({ cwd: "relative/path" })).toThrow(HostError);
  });

  it("rejects missing directory", () => {
    expect(() =>
      resolveAgentCwd({ cwd: path.join(tmpdir(), "mma-missing-" + Date.now()) }),
    ).toThrow(HostError);
  });
});
