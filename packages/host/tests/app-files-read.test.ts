import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readAppFile } from "../src/apps/app-files.ts";
import { asAbsolutePath,asAppId } from "../src/brand.ts";
import { HostError } from "../src/errors.ts";
import { WorkspacePaths } from "../src/paths/workspace-paths.ts";

function fixture(text: string): { paths: WorkspacePaths; appId: string } {
  const root = mkdtempSync(path.join(tmpdir(), "mma-read-"));
  const paths = new WorkspacePaths(asAbsolutePath(root));
  const appId = "com.example.read";
  const dir = paths.appDir(asAppId(appId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ id: appId, name: "R", version: "1.0.0", entry: "ui.tsx" }),
  );
  writeFileSync(path.join(dir, "sample.ts"), text);
  return { paths, appId };
}

describe("readAppFile range", () => {
  const body = "a\nb\nc\nd\ne\n";

  it("reads whole file when range omitted", () => {
    const { paths, appId } = fixture(body);
    const r = readAppFile(paths, appId, "sample.ts");
    expect(r.content).toBe(body);
    expect(r.totalLines).toBe(5);
    expect(r.startLine).toBe(1);
    expect(r.endLine).toBe(5);
    expect(r.truncated).toBeUndefined();
  });

  it("startLine only → through EOF", () => {
    const { paths, appId } = fixture(body);
    const r = readAppFile(paths, appId, "sample.ts", { startLine: 3 });
    expect(r.content).toBe("c\nd\ne");
    expect(r.startLine).toBe(3);
    expect(r.endLine).toBe(5);
  });

  it("endLine only → from line 1", () => {
    const { paths, appId } = fixture(body);
    const r = readAppFile(paths, appId, "sample.ts", { endLine: 2 });
    expect(r.content).toBe("a\nb");
    expect(r.startLine).toBe(1);
    expect(r.endLine).toBe(2);
  });

  it("startLine..endLine inclusive window", () => {
    const { paths, appId } = fixture(body);
    const r = readAppFile(paths, appId, "sample.ts", { startLine: 2, endLine: 4 });
    expect(r.content).toBe("b\nc\nd");
    expect(r.startLine).toBe(2);
    expect(r.endLine).toBe(4);
  });

  it("numbered prefixes absolute line numbers", () => {
    const { paths, appId } = fixture(body);
    const r = readAppFile(paths, appId, "sample.ts", {
      startLine: 2,
      endLine: 3,
      numbered: true,
    });
    expect(r.content).toBe("2|b\n3|c");
  });

  it("rejects startLine beyond EOF", () => {
    const { paths, appId } = fixture(body);
    expect(() => readAppFile(paths, appId, "sample.ts", { startLine: 99 })).toThrow(HostError);
  });

  it("rejects endLine < startLine", () => {
    const { paths, appId } = fixture(body);
    expect(() =>
      readAppFile(paths, appId, "sample.ts", { startLine: 4, endLine: 2 }),
    ).toThrow(/endLine/);
  });
});
